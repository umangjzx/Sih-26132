"""v1.4 phase 3 — admin activity ledger (JSON + CSV export)."""

from datetime import date

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match


def _client(db):
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _as(u):
    app.dependency_overrides[get_current_user] = lambda: u


def _make_deal_with_history(db, farmer_user, buyer_user, client):
    lot = Lot(farmer_id=farmer_user.id, crop="Onion", quantity_kg=1000, quality_grade="A",
              expected_price=2400, available_from=date(2026, 10, 1), location="Pune", status="open")
    dem = Demand(buyer_id=buyer_user.id, crop="Onion", quantity_kg=1000, quality_spec="A",
                 price_band_min=2000, price_band_max=2800, delivery_window="7 days",
                 delivery_district="Pune", status="open")
    db.add_all([lot, dem]); db.commit()
    m = Match(lot_id=lot.id, demand_id=dem.id, score=90, status="proposed")
    db.add(m); db.commit()
    _as(buyer_user)
    oid = client.post(f"/api/matches/{m.id}/offers", json={"price": 2450, "quantity": 1000}).json()["id"]
    _as(farmer_user)
    client.post(f"/api/offers/{oid}/accept")


def test_admin_events_json_and_csv(db, farmer_user, buyer_user, admin_user):
    client = _client(db)
    try:
        _make_deal_with_history(db, farmer_user, buyer_user, client)

        _as(admin_user)
        rows = client.get("/api/admin/events", params={"limit": 50}).json()
        assert len(rows) >= 3
        assert {"offer_made", "offer_accepted", "deal_created"} <= {r["action"] for r in rows}
        assert all("actor_name" in r for r in rows)
        # newest-first
        assert rows[0]["action"] == "deal_created"

        csv_resp = client.get("/api/admin/events.csv")
        assert csv_resp.status_code == 200
        assert "text/csv" in csv_resp.headers["content-type"]
        assert "attachment; filename=agrilink_transaction_log.csv" in csv_resp.headers["content-disposition"]
        body = csv_resp.text
        assert body.splitlines()[0].startswith("created_at,entity_type,entity_id,action")
        assert "deal_created" in body
    finally:
        app.dependency_overrides.clear()


def test_admin_events_requires_admin(db, farmer_user):
    client = _client(db)
    try:
        _as(farmer_user)
        assert client.get("/api/admin/events").status_code == 403
        assert client.get("/api/admin/events.csv").status_code == 403
    finally:
        app.dependency_overrides.clear()
