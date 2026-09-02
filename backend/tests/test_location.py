"""v1.2 location awareness: reverse-geocode fallback, state resolution,
state-filtered options + overview, state-parameterised ingestion.
"""

from datetime import date

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app
from app.models.price_cache import PriceCache
from app.services import ingestion, locations
from app.services.geo import STATE_CENTROIDS, nearest_state


def _client(db):
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


# --------------------------------------------------------------------------- #
# geo helpers
# --------------------------------------------------------------------------- #

def test_nearest_state_fallback_is_coarse_but_valid():
    # The static centroid snap is a last-resort fallback for when the reverse
    # geocoder is down — it is coarse near state borders, so we only assert it
    # returns a real state and gets the home region (Maharashtra, a large state)
    # right.
    assert nearest_state(19.07, 72.87) == "Maharashtra"       # Mumbai (near MH centroid)
    for lat, lon in [(12.97, 77.59), (28.61, 77.21), (26.85, 80.95), (23.02, 72.57), (21.15, 79.09)]:
        assert nearest_state(lat, lon) in STATE_CENTROIDS


def test_reverse_geocode_falls_back_without_network(db, monkeypatch):
    import httpx

    def boom(*_a, **_k):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(httpx.Client, "get", boom)
    from app.services.geocode import reverse_geocode

    r = reverse_geocode(19.07, 72.87, db)
    assert r["state"] == "Maharashtra"
    assert r["source"] == "static"


# --------------------------------------------------------------------------- #
# state-parameterised ingestion
# --------------------------------------------------------------------------- #

def test_ingest_states_config_default(monkeypatch):
    monkeypatch.setattr(ingestion.settings, "ingest_states", "Maharashtra")
    assert ingestion.settings.ingest_state_list == ["Maharashtra"]
    monkeypatch.setattr(ingestion.settings, "ingest_states", "Maharashtra, Karnataka")
    assert ingestion.settings.ingest_state_list == ["Maharashtra", "Karnataka"]
    monkeypatch.setattr(ingestion.settings, "ingest_states", "ALL")
    assert ingestion.settings.ingest_state_list is None


def test_run_ingestion_accepts_state_override(db, monkeypatch):
    captured = {}

    def fake_fetch(_key, states):
        captured["states"] = states
        return []  # force snapshot/fixture fallback

    monkeypatch.setattr(ingestion.settings, "data_gov_in_api_key", "x")
    monkeypatch.setattr(ingestion, "fetch_agmarknet_rows", fake_fetch)
    ingestion.run_ingestion(db, states=["Karnataka"])
    assert captured["states"] == ["Karnataka"]


def test_ensure_state_ingested_no_key(db, monkeypatch):
    locations._LAST_TRY.clear()
    monkeypatch.setattr(ingestion.settings, "data_gov_in_api_key", "")
    r = locations.ensure_state_ingested(db, "Punjab")
    assert r == {"ingested": False, "reason": "no api key", "rows_upserted": 0}


def test_ensure_state_ingested_falls_back_to_demo_fixture(db, monkeypatch):
    """Live feed empty -> synthetic per-state series so the location switch
    always lands on data; a second call sees it already cached."""
    locations._LAST_TRY.clear()
    monkeypatch.setattr(ingestion.settings, "data_gov_in_api_key", "x")
    monkeypatch.setattr(ingestion, "fetch_agmarknet_rows", lambda *a, **k: [])
    r1 = locations.ensure_state_ingested(db, "Punjab")
    assert r1["ingested"] is True and r1["reason"] == "demo-fixture" and r1["rows_upserted"] > 0
    r2 = locations.ensure_state_ingested(db, "Punjab")
    assert r2["reason"] == "already cached"


def test_ensure_state_ingested_rate_limits(db, monkeypatch):
    """A state with no fixture and an empty live feed is rate-limited on retry."""
    locations._LAST_TRY.clear()
    monkeypatch.setattr(ingestion.settings, "data_gov_in_api_key", "x")
    monkeypatch.setattr(ingestion, "fetch_agmarknet_rows", lambda *a, **k: [])
    r1 = locations.ensure_state_ingested(db, "Sikkim")  # not in STATE_FIXTURES
    assert r1["ingested"] is False and r1["reason"] == "no-live-data"
    r2 = locations.ensure_state_ingested(db, "Sikkim")
    assert r2["reason"] == "rate-limited"


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #

def _seed(db, state, market, crop="Wheat"):
    db.add(PriceCache(crop=crop, variety="", market=market, district=market,
                      state=state, date=date(2026, 9, 1),
                      min_price=2000, max_price=2600, modal_price=2400, arrival_volume=None))
    db.commit()


def test_options_state_filter(db):
    _seed(db, "Maharashtra", "Pune", "Onion")
    _seed(db, "Punjab", "Ludhiana", "Wheat")
    client = _client(db)
    try:
        allrows = client.get("/api/options").json()
        assert {r["state"] for r in allrows} == {"Maharashtra", "Punjab"}
        mh = client.get("/api/options", params={"state": "Maharashtra"}).json()
        assert all(r["state"] == "Maharashtra" for r in mh)
    finally:
        app.dependency_overrides.clear()


def test_public_overview_state_filter(db):
    _seed(db, "Maharashtra", "Pune", "Onion")
    _seed(db, "Punjab", "Ludhiana", "Wheat")
    client = _client(db)
    try:
        pb = client.get("/api/public/overview", params={"state": "Punjab"}).json()
        assert [c["crop"] for c in pb["crops"]] == ["Wheat"]
        assert pb["activity"]["state"] == "Punjab"
    finally:
        app.dependency_overrides.clear()


def test_location_resolve_place(db, monkeypatch):
    # geocode() resolves known MH towns locally without network
    client = _client(db)
    try:
        r = client.get("/api/location/resolve", params={"place": "Pune", "ensure_prices": False})
        assert r.status_code == 200
        assert r.json()["state"] == "Maharashtra"
    finally:
        app.dependency_overrides.clear()


def test_location_resolve_state_name_short_circuits(db, monkeypatch):
    """A bare state/UT name (the /states dropdown) resolves to its centroid with
    no geocoding — the free geocoder returns same-named villages abroad."""
    from app.services import locations as loc

    def boom(*_a, **_k):  # geocode() must not be reached for a known state name
        raise AssertionError("state-name resolve must not call geocode()")

    monkeypatch.setattr(loc, "geocode", boom)
    r = loc.resolve_location(db, place="Punjab")
    assert r["state"] == "Punjab" and r["source"] == "state"
    assert r["latitude"] and r["longitude"]
    # case-insensitive too
    assert loc.resolve_location(db, place="  karnataka ")["state"] == "Karnataka"


def test_location_resolve_needs_input(db):
    client = _client(db)
    try:
        assert client.get("/api/location/resolve").status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_storage_fpo_state_scoped(db):
    """v1.2: the directory now covers the major producing states, not just MH.
    Each response is scoped to the requested state."""
    client = _client(db)
    try:
        pb_storage = client.get("/api/storage/nearby", params={"state": "Punjab"}).json()
        assert len(pb_storage) > 0
        assert {f["state"] for f in pb_storage} == {"Punjab"}

        pb_fpo = client.get("/api/fpo/nearby", params={"state": "Punjab"}).json()
        assert len(pb_fpo) > 0
        assert {f["state"] for f in pb_fpo} == {"Punjab"}

        mh = client.get("/api/storage/nearby", params={"district": "Pune", "state": "Maharashtra"}).json()
        assert len(mh) > 0
        assert {f["state"] for f in mh} == {"Maharashtra"}

        # a state with no curated entries yet -> empty, not an error
        assert client.get("/api/fpo/nearby", params={"state": "Sikkim"}).json() == []
    finally:
        app.dependency_overrides.clear()
