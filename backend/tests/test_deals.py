"""Tests for the deal pipeline endpoints (Phase 3).

Same pattern as test_offers.py: one shared ``db``, a single ``TestClient`` with
``get_db`` overridden, and ``get_current_user`` swapped per-request. Every test
clears ``app.dependency_overrides`` in a ``finally``.
"""

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.deal import Deal
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.models.offer import Offer
from app.models.user import User


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _as(user):
    app.dependency_overrides[get_current_user] = lambda: user


def _client(db):
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _seed_deal(db, farmer_user, buyer_user, *, crop="Onion",
               pipeline_status="matched", payment_status="pending"):
    """Insert lot + demand + match + accepted offer + deal. Returns the Deal row."""
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
    db.add(lot)
    db.add(demand)
    db.commit()

    match = Match(lot_id=lot.id, demand_id=demand.id, score=0.9, status="accepted")
    db.add(match)
    db.commit()

    offer = Offer(
        match_id=match.id, from_user_id=farmer_user.id, price=2500,
        quantity=500, message=None, status="accepted",
    )
    db.add(offer)
    db.commit()

    deal = Deal(
        match_id=match.id, agreed_price=2500, agreed_quantity=500,
        logistics_mode="self_pickup", payment_status=payment_status,
        pipeline_status=pipeline_status,
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)
    return deal


def _make_user(db, role, phone, name="Extra"):
    user = User(
        role=role, name=name, phone=phone, district="Pune", taluka="Haveli",
        kyc_status="verified", is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# GET /api/deals/mine
# ---------------------------------------------------------------------------

def test_get_deals_mine_farmer(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    other_farmer = _make_user(db, "farmer", "+910000000004")
    other_buyer = _make_user(db, "buyer", "+910000000005")
    _seed_deal(db, other_farmer, other_buyer, crop="Tomato")

    client = _client(db)
    try:
        _as(farmer_user)
        resp = client.get("/api/deals/mine")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == deal.id
        assert data[0]["lot"]["farmer_id"] == farmer_user.id
        assert data[0]["counterparty"]["id"] == buyer_user.id
    finally:
        app.dependency_overrides.clear()


def test_get_deals_mine_buyer(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    other_farmer = _make_user(db, "farmer", "+910000000004")
    other_buyer = _make_user(db, "buyer", "+910000000005")
    _seed_deal(db, other_farmer, other_buyer, crop="Tomato")

    client = _client(db)
    try:
        _as(buyer_user)
        resp = client.get("/api/deals/mine")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == deal.id
        assert data[0]["demand"]["crop"] == "Onion"
        assert data[0]["counterparty"]["id"] == farmer_user.id
    finally:
        app.dependency_overrides.clear()


def test_get_deals_mine_no_auth(db):
    client = _client(db)
    try:
        resp = client.get("/api/deals/mine")
        assert resp.status_code == 401
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# GET /api/deals/{deal_id}
# ---------------------------------------------------------------------------

def test_get_deal_by_id(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(farmer_user)
        r1 = client.get(f"/api/deals/{deal.id}")
        assert r1.status_code == 200, r1.text
        assert r1.json()["id"] == deal.id

        _as(buyer_user)
        r2 = client.get(f"/api/deals/{deal.id}")
        assert r2.status_code == 200
        assert r2.json()["pipeline_status"] == "matched"
    finally:
        app.dependency_overrides.clear()


def test_get_deal_unrelated_user_forbidden(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    stranger = _make_user(db, "buyer", "+910000000009", name="Stranger")
    client = _client(db)
    try:
        _as(stranger)
        resp = client.get(f"/api/deals/{deal.id}")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# PATCH /api/deals/{deal_id}/advance
# ---------------------------------------------------------------------------

def test_advance_pipeline_farmer(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(farmer_user)
        resp = client.patch(f"/api/deals/{deal.id}/advance")
        assert resp.status_code == 200, resp.text
        assert resp.json()["pipeline_status"] == "offer_accepted"

        db.expire_all()
        row = db.execute(select(Deal).where(Deal.id == deal.id)).scalar_one()
        assert row.pipeline_status == "offer_accepted"
    finally:
        app.dependency_overrides.clear()


def test_advance_pipeline_buyer(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(buyer_user)
        resp = client.patch(f"/api/deals/{deal.id}/advance")
        assert resp.status_code == 200, resp.text
        assert resp.json()["pipeline_status"] == "offer_accepted"
    finally:
        app.dependency_overrides.clear()


def test_advance_to_delivered_requires_seller(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user, pipeline_status="logistics_arranged")
    client = _client(db)
    try:
        _as(buyer_user)
        assert client.patch(f"/api/deals/{deal.id}/advance").status_code == 403
        _as(farmer_user)
        r = client.patch(f"/api/deals/{deal.id}/advance")
        assert r.status_code == 200 and r.json()["pipeline_status"] == "delivered"
    finally:
        app.dependency_overrides.clear()


def test_advance_to_paid_requires_buyer_and_reference(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user, pipeline_status="delivered")
    client = _client(db)
    try:
        # seller cannot mark it paid
        _as(farmer_user)
        assert client.patch(f"/api/deals/{deal.id}/advance").status_code == 403
        # buyer, but no reference -> 422
        _as(buyer_user)
        assert client.patch(f"/api/deals/{deal.id}/advance").status_code == 422
        # buyer with a reference -> paid, and it's recorded
        r = client.patch(
            f"/api/deals/{deal.id}/advance",
            json={"payment_method": "UPI", "payment_reference": "UPI/2026/AX92"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["pipeline_status"] == "paid" and body["payment_status"] == "paid"
        assert body["payment_reference"] == "UPI/2026/AX92"

        db.expire_all()
        row = db.execute(select(Deal).where(Deal.id == deal.id)).scalar_one()
        assert row.payment_status == "paid" and row.payment_method == "UPI"
    finally:
        app.dependency_overrides.clear()


def test_advance_closed_deal_rejected(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user, pipeline_status="closed")
    client = _client(db)
    try:
        _as(farmer_user)
        resp = client.patch(f"/api/deals/{deal.id}/advance")
        assert resp.status_code == 400
    finally:
        app.dependency_overrides.clear()


def test_advance_wrong_user_forbidden(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    stranger = _make_user(db, "farmer", "+910000000009", name="Stranger")
    client = _client(db)
    try:
        _as(stranger)
        resp = client.patch(f"/api/deals/{deal.id}/advance")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.clear()
