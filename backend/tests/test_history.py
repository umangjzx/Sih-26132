"""Tests for GET /api/history (Phase 3, D-08).

Same per-request-override pattern as test_offers.py / test_deals.py.
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
from app.models.offer import Offer


def _as(user):
    app.dependency_overrides[get_current_user] = lambda: user


def _client(db):
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _seed_deal(db, farmer_user, buyer_user, *, crop="Onion"):
    lot = Lot(
        farmer_id=farmer_user.id, crop=crop, quantity_kg=500, quality_grade="A",
        expected_price=2400, available_from=date(2026, 10, 1),
        location="Pune", status="matched",
    )
    demand = Demand(
        buyer_id=buyer_user.id, crop=crop, quantity_kg=600, quality_spec="Grade A",
        price_band_min=2000, price_band_max=2800, delivery_window="7 days",
        status="matched",
    )
    db.add_all([lot, demand])
    db.commit()
    match = Match(lot_id=lot.id, demand_id=demand.id, score=0.9, status="accepted")
    db.add(match)
    db.commit()
    db.add(Offer(match_id=match.id, from_user_id=farmer_user.id, price=2500,
                 quantity=500, message=None, status="accepted"))
    db.commit()
    deal = Deal(match_id=match.id, agreed_price=2500, agreed_quantity=500,
                logistics_mode="self_pickup", payment_status="pending",
                pipeline_status="matched")
    db.add(deal)
    db.commit()
    db.refresh(deal)
    return deal


def test_farmer_history_has_lots_and_deals(db, farmer_user, buyer_user):
    _seed_deal(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(farmer_user)
        r = client.get("/api/history")
        assert r.status_code == 200
        body = r.json()
        assert len(body["lots"]) == 1
        assert body["lots"][0]["farmer_id"] == farmer_user.id
        assert len(body["deals"]) == 1
        assert body["demands"] == []
    finally:
        app.dependency_overrides.clear()


def test_buyer_history_has_demands_and_deals(db, farmer_user, buyer_user):
    _seed_deal(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(buyer_user)
        r = client.get("/api/history")
        assert r.status_code == 200
        body = r.json()
        assert body["lots"] == []
        assert len(body["demands"]) == 1
        assert body["demands"][0]["buyer_id"] == buyer_user.id
        assert len(body["deals"]) == 1
    finally:
        app.dependency_overrides.clear()


def test_farmer_history_no_demands(db, farmer_user, buyer_user):
    _seed_deal(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(farmer_user)
        assert client.get("/api/history").json()["demands"] == []
    finally:
        app.dependency_overrides.clear()


def test_admin_history_sees_everything(db, farmer_user, buyer_user, admin_user):
    _seed_deal(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(admin_user)
        body = client.get("/api/history").json()
        assert len(body["lots"]) == 1
        assert len(body["demands"]) == 1
        assert len(body["deals"]) == 1
    finally:
        app.dependency_overrides.clear()


def test_history_no_auth(db):
    client = _client(db)
    try:
        assert client.get("/api/history").status_code == 401
    finally:
        app.dependency_overrides.clear()
