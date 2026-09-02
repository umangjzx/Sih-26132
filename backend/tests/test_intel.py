"""v1.1 market-intelligence: MSP, crop calendar, storage/FPO lookup,
best-net-market ranking, weather + MSP signal factors, public overview.
"""

from datetime import date, timedelta
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app
from app.models.price_cache import PriceCache
from app.services import reference as ref
from app.services.best_market import best_markets
from app.services.signal import compute_signal


# --------------------------------------------------------------------------- #
# Reference data
# --------------------------------------------------------------------------- #

def test_msp_for_known_and_perishable():
    soy = ref.msp_for("Soybean")
    assert soy and soy["price"] > 0
    assert ref.msp_for("Onion") is None       # perishable -> no MSP
    assert ref.msp_for("Nonesuch") is None


def test_calendar_for():
    cal = ref.calendar_for("Soybean")
    assert cal and cal["crop"] == "Soybean"
    assert "current_phase" in cal and "glut_risk" in cal
    assert ref.calendar_for("Nonesuch") is None


def test_nearby_cold_storage_sorted_and_capped():
    out = ref.nearby_cold_storage(district="Pune", max_km=200, limit=5)
    assert 1 <= len(out) <= 5
    dists = [x["distance_km"] for x in out if x["distance_km"] is not None]
    assert dists == sorted(dists)
    assert all(d <= 200 for d in dists)


def test_nearby_fpos_crop_filter():
    out = ref.nearby_fpos(district="Nashik", crop="Onion", limit=10)
    assert out
    assert all("onion" in f["crops"].lower() for f in out)


# --------------------------------------------------------------------------- #
# Signal factors
# --------------------------------------------------------------------------- #

def _rows(prices):
    base = date(2026, 8, 1)
    return [
        SimpleNamespace(date=base + timedelta(days=i), modal_price=p, arrival_volume=None)
        for i, p in enumerate(prices)
    ]


def test_signal_weather_factor_adds_bias_and_reason():
    flat = _rows([5000] * 20)
    weather = {"source": "open-meteo", "sell_bias": 1, "note": "Heavy rain expected over the next 3 days."}
    sig = compute_signal(flat, weather=weather)
    assert sig is not None
    assert sig.weather_bias == 1
    assert any("Heavy rain" in r for r in sig.reasons)


def test_signal_msp_below_reason():
    flat = _rows([4000] * 20)                  # below Soybean MSP (~4892)
    sig = compute_signal(flat, msp=ref.msp_for("Soybean"))
    assert sig is not None and sig.msp is not None
    assert sig.msp["below"] is True
    assert any("below the Minimum Support Price" in r for r in sig.reasons)


def test_signal_still_works_with_no_context():
    sig = compute_signal(_rows([5000] * 20))
    assert sig is not None and sig.weather_bias == 0 and sig.msp is None


# --------------------------------------------------------------------------- #
# Best market
# --------------------------------------------------------------------------- #

def test_best_markets_ranks_by_net_price(db):
    today = date(2026, 9, 1)
    db.add_all([
        PriceCache(crop="Onion", variety="", market="Pune", district="Pune", state="Maharashtra",
                   date=today, min_price=1800, max_price=2000, modal_price=1900, arrival_volume=None),
        PriceCache(crop="Onion", variety="", market="Lasalgaon", district="Nashik", state="Maharashtra",
                   date=today, min_price=2200, max_price=2500, modal_price=2400, arrival_volume=None),
    ])
    db.commit()
    ranked = best_markets(db, "Onion", origin=(18.52, 73.86), use_routing=False, limit=10)
    assert [r["market"] for r in ranked][:2]  # both present
    nets = [r["net_price_per_qtl"] for r in ranked]
    assert nets == sorted(nets, reverse=True)


def test_best_markets_places_non_maharashtra_markets(db):
    """Regression: markets outside the 36-entry Maharashtra centroid table must
    still be placed via the all-India district table — otherwise best-market
    404s for the whole Tamil Nadu / Coimbatore cluster."""
    today = date(2026, 9, 1)
    db.add_all([
        PriceCache(crop="Onion", variety="", market="Erode Uzhavar Sandhai", district="Erode",
                   state="Tamil Nadu", date=today, min_price=5200, max_price=5600,
                   modal_price=5400, arrival_volume=None),
        PriceCache(crop="Onion", variety="", market="Palladam", district="Tiruppur",
                   state="Tamil Nadu", date=today, min_price=5000, max_price=5400,
                   modal_price=5200, arrival_volume=None),
    ])
    db.commit()
    # origin ~ Coimbatore
    ranked = best_markets(db, "Onion", origin=(11.0168, 76.9558), use_routing=False, limit=10)
    assert {"Erode Uzhavar Sandhai", "Palladam"} <= {r["market"] for r in ranked}


# --------------------------------------------------------------------------- #
# API smoke
# --------------------------------------------------------------------------- #

def _client(db):
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def test_msp_endpoint(seeded_db):
    client = _client(seeded_db)
    try:
        r = client.get("/api/msp", params={"crop": "Soybean", "market": "Pune"})
        assert r.status_code == 200 and r.json()["has_msp"] is True
        r2 = client.get("/api/msp", params={"crop": "Onion"})
        assert r2.status_code == 200 and r2.json()["has_msp"] is False
    finally:
        app.dependency_overrides.clear()


def test_calendar_endpoint(db):
    client = _client(db)
    try:
        assert client.get("/api/calendar", params={"crop": "Tur"}).status_code == 200
        assert client.get("/api/calendar", params={"crop": "Nope"}).status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_storage_and_fpo_endpoints(db):
    client = _client(db)
    try:
        assert client.get("/api/storage/nearby", params={"district": "Nashik"}).status_code == 200
        assert client.get("/api/fpo/nearby", params={"district": "Pune", "crop": "Onion"}).status_code == 200
    finally:
        app.dependency_overrides.clear()


def test_best_markets_endpoint(seeded_db):
    client = _client(seeded_db)
    try:
        r = client.get("/api/markets/best", params={"crop": "Onion", "market": "Pune", "fast": True})
        assert r.status_code == 200
        body = r.json()
        assert "best" in body and "ranked" in body
    finally:
        app.dependency_overrides.clear()


def test_public_overview_endpoint(seeded_db):
    client = _client(seeded_db)
    try:
        r = client.get("/api/public/overview")
        assert r.status_code == 200
        body = r.json()
        assert "crops" in body and "price_trend" in body and "activity" in body
    finally:
        app.dependency_overrides.clear()
