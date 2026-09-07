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
from app.models.notification import Notification
from app.models.offer import Offer
from app.models.user import User
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


def test_accept_offer_notifies_the_offer_maker(db, farmer_user, buyer_user):
    """v1.19 — the farmer who made the offer should hear about it without
    having to keep refreshing the match page."""
    match = _seed_match(db, farmer_user, buyer_user)
    client, _ = _make_clients(db, farmer_user, buyer_user)
    try:
        _as_farmer(farmer_user)
        offer_id = client.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY).json()["id"]

        _as_buyer(buyer_user)
        resp = client.post(f"/api/offers/{offer_id}/accept")
        assert resp.status_code == 200, resp.text

        notif = db.execute(
            select(Notification).where(Notification.user_id == farmer_user.id)
        ).scalar_one_or_none()
        assert notif is not None
        assert notif.kind == "deal"
        assert "accepted" in notif.title.lower()
    finally:
        app.dependency_overrides.clear()


def test_accept_offer_links_an_active_financing_request_to_the_deal(db, farmer_user, buyer_user):
    """v1.20 — a lot pledged for financing that then actually sells should be
    traceable from the financing record, not just discoverable by walking
    Deal -> Match -> Lot by hand."""
    from app.models.financing import FinancingRequest

    match = _seed_match(db, farmer_user, buyer_user)
    lot = db.execute(select(Lot).where(Lot.id == match.lot_id)).scalar_one()
    financing = FinancingRequest(
        farmer_id=farmer_user.id, lot_id=lot.id, requested_amount_inr=1000, status="pending",
    )
    db.add(financing)
    db.commit()

    client, _ = _make_clients(db, farmer_user, buyer_user)
    try:
        _as_farmer(farmer_user)
        offer_id = client.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY).json()["id"]

        _as_buyer(buyer_user)
        resp = client.post(f"/api/offers/{offer_id}/accept")
        assert resp.status_code == 200, resp.text
        deal_id = resp.json()["id"]

        db.expire_all()
        row = db.execute(
            select(FinancingRequest).where(FinancingRequest.id == financing.id)
        ).scalar_one()
        assert row.deal_id == deal_id
    finally:
        app.dependency_overrides.clear()


def test_accept_offer_takes_lot_and_demand_off_the_market(db, farmer_user, buyer_user):
    """Accepting an offer must flip the lot + demand to 'matched' (so the matcher
    and discovery board stop offering an already-committed lot) and reject any
    other still-open matches involving either of them."""
    from app.models.demand import Demand
    from app.models.lot import Lot

    match = _seed_match(db, farmer_user, buyer_user)
    lot = db.get(Lot, match.lot_id)
    demand = db.get(Demand, match.demand_id)

    # a sibling match on the same lot, still open
    other_demand = Demand(
        buyer_id=buyer_user.id, crop="Onion", quantity_kg=500, quality_spec="Grade A",
        price_band_min=2000, price_band_max=2800, delivery_window="7 days", status="open",
    )
    db.add(other_demand)
    db.commit()
    sibling = Match(lot_id=lot.id, demand_id=other_demand.id, score=70.0, status="proposed")
    db.add(sibling)
    db.commit()

    client, _ = _make_clients(db, farmer_user, buyer_user)
    try:
        _as_farmer(farmer_user)
        offer_id = client.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY).json()["id"]
        _as_buyer(buyer_user)
        assert client.post(f"/api/offers/{offer_id}/accept").status_code == 200

        db.expire_all()
        assert db.get(Lot, lot.id).status == "matched"
        assert db.get(Demand, demand.id).status == "matched"
        assert db.get(Match, sibling.id).status == "rejected"
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


def test_stale_offer_on_auto_rejected_match_cannot_be_accepted_or_declined(db, farmer_user, buyer_user):
    """A lot with two live matches (two interested buyers): accepting one
    auto-rejects the sibling match, but a still-pending offer sitting on that
    now-rejected match must not be actionable any more — accepting it used to
    create a second Deal on an already-committed lot; declining it used to
    resurrect the dead match back to 'proposed'."""
    lot = Lot(farmer_id=farmer_user.id, crop="Onion", quantity_kg=500, quality_grade="A",
              expected_price=2400, available_from=date(2026, 10, 1), location="Pune", status="open")
    db.add(lot); db.flush()

    buyer2 = User(role="buyer", name="Second Buyer", phone="+91secondbuyer", district="Pune", taluka="")
    buyer3 = User(role="buyer", name="Third Buyer", phone="+91thirdbuyer", district="Pune", taluka="")
    db.add(buyer2); db.add(buyer3); db.flush()

    d1 = Demand(buyer_id=buyer_user.id, crop="Onion", quantity_kg=500, quality_spec="Grade A",
                price_band_min=2000, price_band_max=2800, delivery_window="7 days", status="open")
    d2 = Demand(buyer_id=buyer2.id, crop="Onion", quantity_kg=500, quality_spec="Grade A",
                price_band_min=2000, price_band_max=2800, delivery_window="7 days", status="open")
    d3 = Demand(buyer_id=buyer3.id, crop="Onion", quantity_kg=500, quality_spec="Grade A",
                price_band_min=2000, price_band_max=2800, delivery_window="7 days", status="open")
    db.add(d1); db.add(d2); db.add(d3); db.commit()
    run_matching(db)

    m1 = db.execute(select(Match).where(Match.demand_id == d1.id)).scalar_one()
    m2 = db.execute(select(Match).where(Match.demand_id == d2.id)).scalar_one()
    m3 = db.execute(select(Match).where(Match.demand_id == d3.id)).scalar_one()

    app.dependency_overrides[get_db] = lambda: db
    client = TestClient(app)
    try:
        # farmer posts an offer on each of the two "other" matches
        _as_farmer(farmer_user)
        off2 = client.post(f"/api/matches/{m2.id}/offers", json=OFFER_BODY).json()["id"]
        off3 = client.post(f"/api/matches/{m3.id}/offers", json=OFFER_BODY).json()["id"]

        # buyer1 offers and farmer accepts on match 1 -> lot committed, m2/m3
        # auto-rejected as siblings on the same lot
        app.dependency_overrides[get_current_user] = lambda: buyer_user
        off1 = client.post(f"/api/matches/{m1.id}/offers", json=OFFER_BODY).json()["id"]
        _as_farmer(farmer_user)
        assert client.post(f"/api/offers/{off1}/accept").status_code == 200

        db.expire_all()
        assert db.get(Match, m2.id).status == "rejected"
        assert db.get(Offer, off2).status == "pending"  # untouched by the accept above

        # buyer2 tries to accept the farmer's still-pending offer on the dead match
        app.dependency_overrides[get_current_user] = lambda: buyer2
        r = client.post(f"/api/offers/{off2}/accept")
        assert r.status_code == 409
        assert db.query(Deal).count() == 1  # no second deal created

        # buyer3 tries to decline the farmer's still-pending offer on the other dead match
        app.dependency_overrides[get_current_user] = lambda: buyer3
        r = client.post(f"/api/offers/{off3}/decline")
        assert r.status_code == 409
        db.expire_all()
        assert db.get(Match, m3.id).status == "rejected"  # not resurrected to 'proposed'
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

        notif = db.execute(
            select(Notification).where(Notification.user_id == farmer_user.id)
        ).scalar_one_or_none()
        assert notif is not None
        assert "declined" in notif.title.lower()
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


# ---------------------------------------------------------------------------
# Offer guards (Module 4 hardening)
# ---------------------------------------------------------------------------

def test_offer_quantity_cannot_exceed_lot(db, farmer_user, buyer_user):
    match = _seed_match(db, farmer_user, buyer_user)  # lot is 500 kg
    client, _ = _make_clients(db, farmer_user, buyer_user)
    try:
        _as_buyer(buyer_user)
        r = client.post(f"/api/matches/{match.id}/offers",
                        json={"price": 2500, "quantity": 5000, "message": "all of it"})
        assert r.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_cannot_stack_your_own_pending_offer(db, farmer_user, buyer_user):
    match = _seed_match(db, farmer_user, buyer_user)
    client, _ = _make_clients(db, farmer_user, buyer_user)
    try:
        _as_buyer(buyer_user)
        assert client.post(f"/api/matches/{match.id}/offers", json=OFFER_BODY).status_code == 201
        # a second offer from the same party, before the other side responds
        r = client.post(f"/api/matches/{match.id}/offers", json={"price": 2600, "quantity": 500})
        assert r.status_code == 409
        # the other party CAN counter
        _as_farmer(farmer_user)
        assert client.post(f"/api/matches/{match.id}/offers", json={"price": 2700, "quantity": 500}).status_code == 201
    finally:
        app.dependency_overrides.clear()


def test_offer_price_upper_bound(db, farmer_user, buyer_user):
    match = _seed_match(db, farmer_user, buyer_user)
    client, _ = _make_clients(db, farmer_user, buyer_user)
    try:
        _as_buyer(buyer_user)
        r = client.post(f"/api/matches/{match.id}/offers",
                        json={"price": 9_000_000, "quantity": 500})
        assert r.status_code == 422
    finally:
        app.dependency_overrides.clear()
