"""v1.4 phase 2 — discovery boards: a buyer browses nearby lots, a farmer
browses nearby demands, and "express interest" opens (or refuses) a match.
"""

from datetime import date

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.models.user import User


def _client(db):
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _as(u):
    app.dependency_overrides[get_current_user] = lambda: u


def _cbe_farmer(db):
    u = User(role="farmer", name="Murugan", phone="+91cbef", district="Coimbatore",
             taluka="", state="Tamil Nadu", latitude=11.0168, longitude=76.9558,
             verification_status="verified")
    db.add(u); db.flush()
    return u


def _cbe_buyer(db):
    u = User(role="buyer", name="Kovai", phone="+91cbeb", district="Coimbatore",
             taluka="", state="Tamil Nadu", latitude=11.0168, longitude=76.9558)
    db.add(u); db.flush()
    return u


def _chennai_buyer(db):
    u = User(role="buyer", name="Chennai Co", phone="+91chn", district="Chennai",
             taluka="", state="Tamil Nadu", latitude=13.0827, longitude=80.2707)
    db.add(u); db.flush()
    return u


def _onion_lot(db, farmer):
    lot = Lot(farmer_id=farmer.id, crop="Onion", quantity_kg=1000, quality_grade="A",
              expected_price=2400, available_from=date(2026, 10, 1), location="Coimbatore",
              latitude=11.0168, longitude=76.9558, status="open")
    db.add(lot); db.flush()
    return lot


def test_buyer_browse_lots_filters_by_radius(db):
    farmer = _cbe_farmer(db)
    _onion_lot(db, farmer)
    near, far = _cbe_buyer(db), _chennai_buyer(db)
    db.commit()
    client = _client(db)
    try:
        _as(near)
        rows = client.get("/api/lots/browse", params={"radius_km": 200}).json()
        assert len(rows) == 1 and rows[0]["farmer_name"] == "Murugan"
        assert rows[0]["farmer_verified"] is True and rows[0]["distance_km"] == 0.0

        _as(far)
        assert client.get("/api/lots/browse", params={"radius_km": 200}).json() == []
        # without a radius the Chennai buyer still sees it, just ~450 km away
        wide = client.get("/api/lots/browse").json()
        assert len(wide) == 1 and wide[0]["distance_km"] > 400
    finally:
        app.dependency_overrides.clear()


def test_browse_lots_requires_buyer(db):
    farmer = _cbe_farmer(db)
    db.commit()
    client = _client(db)
    try:
        _as(farmer)
        assert client.get("/api/lots/browse").status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_express_interest_opens_a_match(db):
    farmer, buyer = _cbe_farmer(db), _cbe_buyer(db)
    lot = _onion_lot(db, farmer)
    db.add(Demand(buyer_id=buyer.id, crop="Onion", quantity_kg=1000, quality_spec="Grade A",
                  price_band_min=2200, price_band_max=2700, delivery_window="Within 7 days",
                  delivery_district="Coimbatore", latitude=11.0168, longitude=76.9558, status="open"))
    db.commit()
    client = _client(db)
    try:
        _as(buyer)
        r = client.post(f"/api/lots/{lot.id}/express-interest")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["matched"] is True and body["match_id"] and body["score"] >= 30
        assert db.query(Match).count() == 1
    finally:
        app.dependency_overrides.clear()


def test_browse_hides_a_lot_the_buyer_already_matched(db):
    farmer, buyer = _cbe_farmer(db), _cbe_buyer(db)
    lot = _onion_lot(db, farmer)
    db.add(Demand(buyer_id=buyer.id, crop="Onion", quantity_kg=1000, quality_spec="Grade A",
                  price_band_min=2200, price_band_max=2700, delivery_window="Within 7 days",
                  delivery_district="Coimbatore", latitude=11.0168, longitude=76.9558, status="open"))
    db.commit()
    client = _client(db)
    try:
        _as(buyer)
        assert len(client.get("/api/lots/browse").json()) == 1
        # after expressing interest the lot is no longer "new" on the board
        assert client.post(f"/api/lots/{lot.id}/express-interest").status_code == 200
        assert client.get("/api/lots/browse").json() == []
    finally:
        app.dependency_overrides.clear()


def test_express_interest_without_a_demand_409s(db):
    farmer, buyer = _cbe_farmer(db), _cbe_buyer(db)
    lot = _onion_lot(db, farmer)
    db.commit()
    client = _client(db)
    try:
        _as(buyer)
        assert client.post(f"/api/lots/{lot.id}/express-interest").status_code == 409
    finally:
        app.dependency_overrides.clear()


def test_express_interest_refuses_a_far_pair(db):
    farmer = _cbe_farmer(db)
    lot = _onion_lot(db, farmer)
    buyer = _chennai_buyer(db)
    db.add(Demand(buyer_id=buyer.id, crop="Onion", quantity_kg=1000, quality_spec="Grade A",
                  price_band_min=2200, price_band_max=2700, delivery_window="Within 7 days",
                  delivery_district="Chennai", latitude=13.0827, longitude=80.2707, status="open"))
    db.commit()
    client = _client(db)
    try:
        _as(buyer)
        r = client.post(f"/api/lots/{lot.id}/express-interest")
        assert r.status_code == 200
        body = r.json()
        assert body["matched"] is False and "range" in (body["reason"] or "")
        assert db.query(Match).count() == 0
    finally:
        app.dependency_overrides.clear()
