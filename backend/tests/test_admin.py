"""Tests for GET /api/admin/dashboard (Phase 3, D-09).

Admin-only aggregate view; farmer/buyer get 403, unauthenticated gets 401.
"""

from datetime import date

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.deal import Deal
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match


def _as(user):
    app.dependency_overrides[get_current_user] = lambda: user


def _client(db):
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _seed_lot_demand_deal(db, farmer_user, buyer_user):
    lot = Lot(
        farmer_id=farmer_user.id, crop="Onion", quantity_kg=500, quality_grade="A",
        expected_price=2400, available_from=date(2026, 10, 1),
        location="Pune", status="open",
    )
    demand = Demand(
        buyer_id=buyer_user.id, crop="Onion", quantity_kg=600, quality_spec="A",
        price_band_min=2000, price_band_max=2800, delivery_window="7 days",
        status="open",
    )
    db.add_all([lot, demand])
    db.commit()
    match = Match(lot_id=lot.id, demand_id=demand.id, score=0.9, status="accepted")
    db.add(match)
    db.commit()
    deal = Deal(match_id=match.id, agreed_price=2500, agreed_quantity=500,
                logistics_mode="self_pickup", payment_status="pending",
                pipeline_status="matched")
    db.add(deal)
    db.commit()


_REQUIRED_FIELDS = {
    "total_lots", "open_lots", "total_demands", "open_demands",
    "total_deals", "open_disputes_count", "price_trend_summary", "dispute_queue",
}


def test_dashboard_admin_ok(db, admin_user):
    client = _client(db)
    try:
        _as(admin_user)
        r = client.get("/api/admin/dashboard")
        assert r.status_code == 200
        assert _REQUIRED_FIELDS <= set(r.json())
    finally:
        app.dependency_overrides.clear()


def test_dashboard_has_correct_counts(db, admin_user, farmer_user, buyer_user):
    _seed_lot_demand_deal(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(admin_user)
        body = client.get("/api/admin/dashboard").json()
        assert body["total_lots"] >= 1
        assert body["open_lots"] >= 1
        assert body["total_demands"] >= 1
        assert body["total_deals"] >= 1
        assert body["open_disputes_count"] == 0
        assert isinstance(body["price_trend_summary"], list)
        assert body["dispute_queue"] == []
    finally:
        app.dependency_overrides.clear()


def test_dashboard_farmer_forbidden(db, farmer_user):
    client = _client(db)
    try:
        _as(farmer_user)
        assert client.get("/api/admin/dashboard").status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_dashboard_buyer_forbidden(db, buyer_user):
    client = _client(db)
    try:
        _as(buyer_user)
        assert client.get("/api/admin/dashboard").status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_dashboard_no_auth(db):
    client = _client(db)
    try:
        assert client.get("/api/admin/dashboard").status_code == 401
    finally:
        app.dependency_overrides.clear()
