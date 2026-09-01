"""Tests for the offer/counter-offer endpoints and Deal creation.

All tests that need both farmer and buyer perspectives use a single ``db``
and build two TestClient instances that share it — the same pattern used in
test_lots.py::test_get_lot_unrelated_buyer_forbidden.
"""

from datetime import date

import pytest
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
from app.services.matching import run_matching


# ---------------------------------------------------------------------------
# Helpers — build shared-db clients and seed data
# ---------------------------------------------------------------------------

def _make_clients(db, farmer_user, buyer_user):
    """Return a single TestClient with get_db set. Tests switch get_current_user themselves."""
    app.dependency_overrides[get_db] = lambda: db
    client = TestClient(app)
    return client, client  # same client; caller switches get_current_user per request


def _as_farmer(farmer_user):
    app.dependency_overrides[get_current_user] = lambda: farmer_user


def _as_buyer(buyer_user):
    app.dependency_overrides[get_current_user] = lambda: buyer_user


def _seed_match(db, farmer_user, buyer_user, crop="Onion"):
    """Insert a lot, demand, and run matching. Returns the Match row."""
    lot = Lot(
        farmer_id=farmer_user.id, crop=crop, quantity_kg=500,
        quality_grade="A", expected_price=2400,
        available_from=date(2026, 10, 1), location="Pune", status="open",
    )
    demand = Demand(
        buyer_id=buyer_user.id, crop=crop, quantity_kg=600,
        quality_spec="Grade A", price_band_min=2000, price_band_max=2800,
        delivery_window="7 days", status="open",
    )
    db.add(lot)
    db.add(demand)
    db.commit()
    run_matching(db)
    return db.execute(select(Match)).scalar_one()


OFFER_BODY = {"price": 2500.0, "quantity": 500.0, "message": "Interested"}


# ---------------------------------------------------------------------------
# POST /api/matches/{match_id}/offers
# ---------------------------------------------------------------------------

def test_post_offer_as_farmer(db, farmer_user, buyer_user):
    match = _seed_match(db, farmer_user, buyer_user)
    client, _ = _make_clients(db, farmer_user, buyer_user)
    try:
        _as_farmer(farmer_user)
        resp = client.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY)
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["from_user_id"] == farmer_user.id
        assert data["status"] == "pending"
        assert data["price"] == 2500.0
        # Match status should be 'offered'
        db.expire_all()
        m = db.execute(select(Match).where(Match.id == match.id)).scalar_one()
        assert m.status == "offered"
    finally:
        app.dependency_overrides.clear()


def test_post_offer_as_buyer(db, farmer_user, buyer_user):
    match = _seed_match(db, farmer_user, buyer_user)
    client, _ = _make_clients(db, farmer_user, buyer_user)
    try:
        _as_buyer(buyer_user)
        resp = client.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY)
        assert resp.status_code == 201, resp.text
        assert resp.json()["from_user_id"] == buyer_user.id
    finally:
        app.dependency_overrides.clear()


def test_post_offer_sets_previous_to_countered(db, farmer_user, buyer_user):
    match = _seed_match(db, farmer_user, buyer_user)
    client, _ = _make_clients(db, farmer_user, buyer_user)
    try:
        _as_farmer(farmer_user)
        r1 = client.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY)
        first_id = r1.json()["id"]

        _as_buyer(buyer_user)
        r2 = client.post(f"/api/matches/{match.id}/offers", json={**OFFER_BODY, "price": 2600.0})
        assert r2.status_code == 201

        db.expire_all()
        first = db.execute(select(Offer).where(Offer.id == first_id)).scalar_one()
        assert first.status == "countered"
        assert r2.json()["status"] == "pending"
    finally:
        app.dependency_overrides.clear()


def test_post_offer_unrelated_user_forbidden(db, farmer_user, buyer_user):
    from app.models.user import User
    match = _seed_match(db, farmer_user, buyer_user)
    stranger = User(role="farmer", name="X", phone="+910099990000",
                    district="Nagpur", taluka="Nagpur", is_active=True)
    db.add(stranger)
    db.commit()
    db.refresh(stranger)

    app.dependency_overrides[get_db] = lambda: db
    _as_farmer(stranger)
    try:
        sc = TestClient(app)
        resp = sc.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY)
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_post_offer_on_accepted_match_rejected(db, farmer_user, buyer_user):
    match = _seed_match(db, farmer_user, buyer_user)
    match.status = "accepted"
    db.commit()

    app.dependency_overrides[get_db] = lambda: db
    _as_farmer(farmer_user)
    try:
        fc = TestClient(app)
        resp = fc.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY)
        assert resp.status_code == 400
    finally:
        app.dependency_overrides.clear()


def test_get_offers_thread_ordered(db, farmer_user, buyer_user):
    match = _seed_match(db, farmer_user, buyer_user)
    client, _ = _make_clients(db, farmer_user, buyer_user)
    try:
        _as_farmer(farmer_user)
        client.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY)
        _as_buyer(buyer_user)
        client.post(f"/api/matches/{match.id}/offers", json={**OFFER_BODY, "price": 2600.0})

        _as_farmer(farmer_user)
        resp = client.get(f"/api/matches/{match.id}/offers")
        assert resp.status_code == 200
        offers = resp.json()
        assert len(offers) == 2
        assert offers[0]["price"] == 2500.0
        assert offers[1]["price"] == 2600.0
    finally:
        app.dependency_overrides.clear()


def test_accept_offer_creates_deal(db, farmer_user, buyer_user):
    match = _seed_match(db, farmer_user, buyer_user)
    client, _ = _make_clients(db, farmer_user, buyer_user)
    try:
        _as_farmer(farmer_user)
        offer_id = client.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY).json()["id"]

        _as_buyer(buyer_user)
        resp = client.post(f"/api/offers/{offer_id}/accept")
        assert resp.status_code == 200, resp.text
        deal_data = resp.json()
        assert deal_data["agreed_price"] == 2500.0
        assert deal_data["agreed_quantity"] == 500.0
        assert deal_data["pipeline_status"] == "matched"

        deal = db.execute(select(Deal)).scalar_one_or_none()
        assert deal is not None

        db.expire_all()
        m = db.execute(select(Match).where(Match.id == match.id)).scalar_one()
        assert m.status == "accepted"
    finally:
        app.dependency_overrides.clear()


def test_accept_own_offer_forbidden(db, farmer_user, buyer_user):
    match = _seed_match(db, farmer_user, buyer_user)
    app.dependency_overrides[get_db] = lambda: db
    _as_farmer(farmer_user)
    try:
        fc = TestClient(app)
        offer_id = fc.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY).json()["id"]
        resp = fc.post(f"/api/offers/{offer_id}/accept")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_accept_non_pending_offer(db, farmer_user, buyer_user):
    match = _seed_match(db, farmer_user, buyer_user)
    client, _ = _make_clients(db, farmer_user, buyer_user)
    try:
        _as_farmer(farmer_user)
        offer_id = client.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY).json()["id"]

        _as_buyer(buyer_user)
        client.post(f"/api/offers/{offer_id}/accept")
        resp = client.post(f"/api/offers/{offer_id}/accept")
        assert resp.status_code == 400
    finally:
        app.dependency_overrides.clear()


def test_all_other_offers_declined_on_accept(db, farmer_user, buyer_user):
    match = _seed_match(db, farmer_user, buyer_user)
    client, _ = _make_clients(db, farmer_user, buyer_user)
    try:
        _as_farmer(farmer_user)
        client.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY)
        _as_buyer(buyer_user)
        second_id = client.post(
            f"/api/matches/{match.id}/offers", json={**OFFER_BODY, "price": 2600.0}
        ).json()["id"]

        _as_farmer(farmer_user)
        resp = client.post(f"/api/offers/{second_id}/accept")
        assert resp.status_code == 200

        db.expire_all()
        all_offers = db.execute(select(Offer).where(Offer.match_id == match.id)).scalars().all()
        statuses = {o.status for o in all_offers}
        assert "pending" not in statuses
    finally:
        app.dependency_overrides.clear()


def test_decline_offer(db, farmer_user, buyer_user):
    match = _seed_match(db, farmer_user, buyer_user)
    client, _ = _make_clients(db, farmer_user, buyer_user)
    try:
        _as_farmer(farmer_user)
        offer_id = client.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY).json()["id"]

        _as_buyer(buyer_user)
        resp = client.post(f"/api/offers/{offer_id}/decline")
        assert resp.status_code == 200
        assert resp.json()["detail"] == "Offer declined"

        db.expire_all()
        o = db.execute(select(Offer).where(Offer.id == offer_id)).scalar_one()
        assert o.status == "declined"
        m = db.execute(select(Match).where(Match.id == match.id)).scalar_one()
        assert m.status == "proposed"
    finally:
        app.dependency_overrides.clear()


def test_decline_own_offer_forbidden(db, farmer_user, buyer_user):
    match = _seed_match(db, farmer_user, buyer_user)
    app.dependency_overrides[get_db] = lambda: db
    _as_farmer(farmer_user)
    try:
        fc = TestClient(app)
        offer_id = fc.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY).json()["id"]
        resp = fc.post(f"/api/offers/{offer_id}/decline")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_decline_with_other_pending_match_stays_offered(db, farmer_user, buyer_user):
    match = _seed_match(db, farmer_user, buyer_user)
    client, _ = _make_clients(db, farmer_user, buyer_user)
    try:
        _as_farmer(farmer_user)
        client.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY)

        _as_buyer(buyer_user)
        offer2_id = client.post(
            f"/api/matches/{match.id}/offers", json={**OFFER_BODY, "price": 2600.0}
        ).json()["id"]

        _as_farmer(farmer_user)
        resp = client.post(f"/api/offers/{offer2_id}/decline")
        assert resp.status_code == 200

        db.expire_all()
        m = db.execute(select(Match).where(Match.id == match.id)).scalar_one()
        assert m.status == "proposed"
    finally:
        app.dependency_overrides.clear()
