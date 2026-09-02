"""v1.4 phase 2 — per-deal logistics plan."""

from datetime import date

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.deal import Deal
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.logistics import DealLogistics
from app.models.match import Match


def _client(db):
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _as(u):
    app.dependency_overrides[get_current_user] = lambda: u


def _seed(db, farmer_user, buyer_user):
    lot = Lot(farmer_id=farmer_user.id, crop="Onion", quantity_kg=1000, quality_grade="A",
              expected_price=2400, available_from=date(2026, 10, 1), location="Pune",
              latitude=18.5204, longitude=73.8567, status="matched")
    dem = Demand(buyer_id=buyer_user.id, crop="Onion", quantity_kg=1000, quality_spec="A",
                 price_band_min=2200, price_band_max=2700, delivery_window="7 days",
                 delivery_district="Nashik", latitude=19.9975, longitude=73.7898, status="matched")
    db.add_all([lot, dem]); db.commit()
    m = Match(lot_id=lot.id, demand_id=dem.id, score=90, status="accepted")
    db.add(m); db.commit()
    d = Deal(match_id=m.id, agreed_price=2500, agreed_quantity=1000,
             pipeline_status="offer_accepted")
    db.add(d); db.commit()
    return d


def test_get_logistics_returns_a_draft_with_distance_and_cost(db, farmer_user, buyer_user):
    deal = _seed(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(farmer_user)
        r = client.get(f"/api/deals/{deal.id}/logistics")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["is_draft"] is True
        # Pune -> Nashik is ~165 km; cost = km * 10 qtl * 0.4 ₹/qtl/km
        assert 120 < body["distance_km"] < 220
        assert body["est_cost_inr"] > 0
        assert body["pickup_point"] == "Pune" and body["drop_point"] == "Nashik"
    finally:
        app.dependency_overrides.clear()


def test_put_logistics_saves_and_recomputes(db, farmer_user, buyer_user):
    deal = _seed(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(buyer_user)
        r = client.put(f"/api/deals/{deal.id}/logistics", json={
            "mode": "hired_transport", "transporter_name": "Kisan Transport",
            "transporter_phone": "+919812345678", "vehicle_type": "truck_6t",
            "pickup_date": "2026-10-03", "status": "in_transit",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["is_draft"] is False
        assert body["transporter_name"] == "Kisan Transport"
        assert body["status"] == "in_transit"
        assert body["distance_km"] > 0 and body["est_cost_inr"] > 0

        # second GET returns the saved row, not a draft
        assert client.get(f"/api/deals/{deal.id}/logistics").json()["is_draft"] is False
        assert db.query(DealLogistics).count() == 1
    finally:
        app.dependency_overrides.clear()


def test_logistics_access_is_deal_scoped(db, farmer_user, buyer_user, admin_user):
    deal = _seed(db, farmer_user, buyer_user)
    from app.models.user import User
    stranger = User(role="farmer", name="X", phone="+91stranger", district="Pune", taluka="")
    db.add(stranger); db.commit()
    client = _client(db)
    try:
        _as(stranger)
        assert client.get(f"/api/deals/{deal.id}/logistics").status_code == 403
        _as(admin_user)
        assert client.get(f"/api/deals/{deal.id}/logistics").status_code == 200
    finally:
        app.dependency_overrides.clear()
