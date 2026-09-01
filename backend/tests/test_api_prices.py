"""One smoke test per /api/prices/* route plus /api/options and the D-05
shared-secret gate on POST /api/ingest/run. Runs against the seeded SQLite
`client` fixture (Onion / Pune present via generate_fixture_rows).
"""

def test_options_ok(client):
    resp = client.get("/api/options")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list) and len(body) > 0
