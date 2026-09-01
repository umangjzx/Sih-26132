"""One smoke test per /api/prices/* route plus /api/options and the D-05
shared-secret gate on POST /api/ingest/run. Runs against the seeded SQLite
`client` fixture (Onion / Pune present via generate_fixture_rows).
"""

from app.api import prices


def test_options_ok(client):
    resp = client.get("/api/options")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list) and len(body) > 0


def test_trend_ok(client):
    resp = client.get("/api/prices/trend", params={"crop": "Onion", "market": "Pune", "days": 30})
    assert resp.status_code == 200
    assert resp.json()["points"]


def test_signal_ok(client):
    resp = client.get("/api/prices/signal", params={"crop": "Onion", "market": "Pune"})
    assert resp.status_code == 200
    assert resp.json()["recommendation"] in {"sell_now", "wait", "hold"}


def test_nearby_caps_and_limits(client):
    resp = client.get("/api/prices/nearby", params={"crop": "Onion", "district": "Pune"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) <= 8
    assert all(x["distance_km"] is None or x["distance_km"] <= 200 for x in body)
    numeric = [x["distance_km"] for x in body if x["distance_km"] is not None]
    assert numeric == sorted(numeric)


def test_nearby_respects_explicit_limit(client):
    resp = client.get(
        "/api/prices/nearby",
        params={"crop": "Onion", "district": "Pune", "limit": 3, "max_distance_km": 50},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) <= 3
    assert all(x["distance_km"] is None or x["distance_km"] <= 50 for x in body)


def test_ingest_requires_secret(client, monkeypatch):
    monkeypatch.setattr(prices.settings, "ingest_trigger_secret", "topsecret")
    # Keep the 200 path hermetic: no key -> resolve_ingestion_rows() skips the
    # live call and resolves via the committed snapshot (no network, no timeout).
    monkeypatch.setattr(prices.ingestion.settings, "data_gov_in_api_key", "")

    assert client.post("/api/ingest/run").status_code == 403
    assert client.post("/api/ingest/run", headers={"X-Ingest-Secret": "wrong"}).status_code == 403

    ok = client.post("/api/ingest/run", headers={"X-Ingest-Secret": "topsecret"})
    assert ok.status_code == 200
    assert "source" in ok.json()
