"""Tests for the dispute endpoints (Phase 3).

Reuses ``_seed_deal`` / ``_as`` / ``_client`` / ``_make_user`` from
``tests.test_deals`` to build the underlying lot + demand + match + deal.
"""

from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.dispute import Dispute
from app.models.forward import ForwardBid, ForwardCommitment
from app.models.notification import Notification

from tests.test_deals import _as, _client, _make_user, _seed_deal


# ---------------------------------------------------------------------------
# POST /api/deals/{deal_id}/disputes
# ---------------------------------------------------------------------------

def test_raise_dispute_farmer(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(farmer_user)
        resp = client.post(
            f"/api/deals/{deal.id}/disputes", json={"reason": "Delivery was 3 days late"}
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["status"] == "open"
        assert body["raised_by"] == farmer_user.id
        assert body["deal_id"] == deal.id

        db.expire_all()
        rows = db.execute(
            select(Dispute).where(Dispute.deal_id == deal.id)
        ).scalars().all()
        assert len(rows) == 1
        assert rows[0].reason == "Delivery was 3 days late"
    finally:
        app.dependency_overrides.clear()


def test_raise_dispute_buyer(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(buyer_user)
        resp = client.post(
            f"/api/deals/{deal.id}/disputes", json={"reason": "Quantity short by 40kg"}
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["raised_by"] == buyer_user.id
    finally:
        app.dependency_overrides.clear()


def test_raise_dispute_unrelated_user_forbidden(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    stranger = _make_user(db, "buyer", "+910000000009", name="Stranger")
    client = _client(db)
    try:
        _as(stranger)
        resp = client.post(f"/api/deals/{deal.id}/disputes", json={"reason": "not mine"})
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_raise_duplicate_open_dispute_rejected(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(farmer_user)
        r1 = client.post(f"/api/deals/{deal.id}/disputes", json={"reason": "First issue"})
        assert r1.status_code == 201

        _as(buyer_user)
        r2 = client.post(f"/api/deals/{deal.id}/disputes", json={"reason": "Second issue"})
        assert r2.status_code == 409
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# GET /api/deals/{deal_id}/disputes
# ---------------------------------------------------------------------------

def test_get_disputes(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    admin = _make_user(db, "admin", "+910000000003", name="Admin")
    client = _client(db)
    try:
        _as(farmer_user)
        client.post(f"/api/deals/{deal.id}/disputes", json={"reason": "Late delivery"})

        for viewer in (farmer_user, buyer_user, admin):
            _as(viewer)
            resp = client.get(f"/api/deals/{deal.id}/disputes")
            assert resp.status_code == 200, resp.text
            data = resp.json()
            assert len(data) == 1
            assert data[0]["reason"] == "Late delivery"
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# PATCH /api/disputes/{dispute_id}/close
# ---------------------------------------------------------------------------

def test_close_dispute_admin(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    admin = _make_user(db, "admin", "+910000000003", name="Admin")
    client = _client(db)
    try:
        _as(farmer_user)
        dispute_id = client.post(
            f"/api/deals/{deal.id}/disputes", json={"reason": "Payment not received"}
        ).json()["id"]

        _as(admin)
        resp = client.patch(f"/api/disputes/{dispute_id}/close",
                            json={"outcome": "favour_buyer", "resolution": "Buyer never got the goods."})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "resolved"
        assert body["outcome"] == "favour_buyer"
        assert body["resolved_by"] == admin.id and body["resolved_at"]

        # already resolved -> 400
        resp2 = client.patch(f"/api/disputes/{dispute_id}/close", json={"outcome": "dismissed"})
        assert resp2.status_code == 400

        db.expire_all()
        row = db.execute(
            select(Dispute).where(Dispute.id == dispute_id)
        ).scalar_one()
        assert row.status == "resolved"

        # v1.19 — both the farmer and the buyer should be told the outcome,
        # not just whoever happens to reopen the deal page.
        notifs = db.execute(
            select(Notification).where(Notification.kind == "dispute")
        ).scalars().all()
        notified_ids = {n.user_id for n in notifs}
        assert notified_ids == {farmer_user.id, buyer_user.id}
    finally:
        app.dependency_overrides.clear()


def test_close_dispute_non_admin_forbidden(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(farmer_user)
        dispute_id = client.post(
            f"/api/deals/{deal.id}/disputes", json={"reason": "Dispute reason"}
        ).json()["id"]

        # farmer (non-admin) cannot close
        resp = client.patch(f"/api/disputes/{dispute_id}/close")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Module 6 hardening — evidence, withdraw, resolution outcome
# ---------------------------------------------------------------------------

def test_raise_dispute_with_evidence_url(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(buyer_user)
        r = client.post(f"/api/deals/{deal.id}/disputes",
                        json={"reason": "Short weight", "evidence_url": "https://x.test/weighbridge.jpg"})
        assert r.status_code == 201
        assert r.json()["evidence_url"].startswith("https://")
        # bad scheme rejected
        db.query(Dispute).delete(); db.commit()
        assert client.post(f"/api/deals/{deal.id}/disputes",
                           json={"reason": "x", "evidence_url": "javascript:1"}).status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_raiser_can_withdraw_own_open_dispute(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(farmer_user)
        did = client.post(f"/api/deals/{deal.id}/disputes", json={"reason": "mistake"}).json()["id"]
        r = client.post(f"/api/disputes/{did}/withdraw")
        assert r.status_code == 200 and r.json()["status"] == "withdrawn"
        # the other party can't withdraw someone else's
        _as(buyer_user)
        did2 = client.post(f"/api/deals/{deal.id}/disputes", json={"reason": "again"}).json()["id"]
        _as(farmer_user)
        assert client.post(f"/api/disputes/{did2}/withdraw").status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_resolve_requires_valid_outcome(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)
    admin = _make_user(db, "admin", "+910000000009", name="A")
    client = _client(db)
    try:
        _as(buyer_user)
        did = client.post(f"/api/deals/{deal.id}/disputes", json={"reason": "x"}).json()["id"]
        _as(admin)
        assert client.patch(f"/api/disputes/{did}/close", json={"outcome": "nonsense"}).status_code == 422
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# v1.11 — forward-contract breach penalty on dispute resolution
# ---------------------------------------------------------------------------

_FROM = (date.today() + timedelta(days=40)).isoformat()
_TO = (date.today() + timedelta(days=70)).isoformat()


def _seed_forward_deal(client, farmer_user, buyer_user, *, price_per_qtl=7400.0, quantity_kg=2000.0):
    """Buyer posts a bid, farmer commits, buyer accepts — via the real forward
    API, so the resulting deal is materialised exactly the way production
    traffic creates one."""
    _as(buyer_user)
    bid = client.post("/api/forward/bids", json={
        "crop": "Tur", "quantity_kg": quantity_kg, "price_min": 7000, "price_max": 7800,
        "delivery_from": _FROM, "delivery_to": _TO,
    }).json()

    _as(farmer_user)
    cm = client.post(f"/api/forward/bids/{bid['id']}/commitments", json={
        "quantity_kg": quantity_kg, "price_per_qtl": price_per_qtl,
        "expected_ready": (date.today() + timedelta(days=55)).isoformat(),
    }).json()

    _as(buyer_user)
    accepted = client.post(f"/api/forward/commitments/{cm['id']}/accept").json()
    return accepted["deal_id"], cm["id"]


def test_resolve_with_forward_penalty_marks_commitment_breached(db, farmer_user, buyer_user):
    client = _client(db)
    try:
        deal_id, commitment_id = _seed_forward_deal(client, farmer_user, buyer_user,
                                                     price_per_qtl=7400, quantity_kg=2000)
        admin = _make_user(db, "admin", "+910000000009", name="A")

        _as(farmer_user)
        dispute_id = client.post(
            f"/api/deals/{deal_id}/disputes",
            json={"reason": "Buyer never picked up or paid for the crop"},
        ).json()["id"]

        _as(admin)
        resp = client.patch(
            f"/api/disputes/{dispute_id}/close",
            json={"outcome": "favour_farmer", "resolution": "Buyer defaulted.",
                  "apply_forward_penalty": True},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "resolved"

        db.expire_all()
        cm = db.get(ForwardCommitment, commitment_id)
        assert cm.status == "breached"
        assert cm.breach_status == "buyer_breach"  # favour_farmer -> buyer was at fault
        assert cm.penalty_inr == round(2000 / 100 * 7400 * 0.1, 2)
        assert cm.breached_at is not None
    finally:
        app.dependency_overrides.clear()


def test_resolve_with_forward_penalty_favour_buyer_blames_farmer(db, farmer_user, buyer_user):
    client = _client(db)
    try:
        deal_id, commitment_id = _seed_forward_deal(client, farmer_user, buyer_user)
        admin = _make_user(db, "admin", "+910000000009", name="A")

        _as(buyer_user)
        dispute_id = client.post(
            f"/api/deals/{deal_id}/disputes", json={"reason": "Farmer never delivered"},
        ).json()["id"]

        _as(admin)
        resp = client.patch(
            f"/api/disputes/{dispute_id}/close",
            json={"outcome": "favour_buyer", "apply_forward_penalty": True},
        )
        assert resp.status_code == 200, resp.text

        db.expire_all()
        assert db.get(ForwardCommitment, commitment_id).breach_status == "farmer_breach"
    finally:
        app.dependency_overrides.clear()


def test_forward_penalty_rejected_without_a_clear_fault_outcome(db, farmer_user, buyer_user):
    client = _client(db)
    try:
        deal_id, commitment_id = _seed_forward_deal(client, farmer_user, buyer_user)
        admin = _make_user(db, "admin", "+910000000009", name="A")

        _as(farmer_user)
        dispute_id = client.post(
            f"/api/deals/{deal_id}/disputes", json={"reason": "Something went wrong"},
        ).json()["id"]

        _as(admin)
        for outcome in ("split", "dismissed", "no_fault"):
            resp = client.patch(
                f"/api/disputes/{dispute_id}/close",
                json={"outcome": outcome, "apply_forward_penalty": True},
            )
            assert resp.status_code == 422, resp.text
            # rejecting the penalty must not have resolved the dispute either —
            # the whole request fails together, so a retry with a valid ruling
            # (this time without the flag) is still possible
            db.expire_all()
            assert db.execute(
                select(Dispute.status).where(Dispute.id == dispute_id)
            ).scalar_one() == "open"

        db.expire_all()
        assert db.get(ForwardCommitment, commitment_id).status == "accepted"
    finally:
        app.dependency_overrides.clear()


def test_forward_penalty_rejected_when_deal_not_forward_originated(db, farmer_user, buyer_user):
    deal = _seed_deal(db, farmer_user, buyer_user)  # a plain (non-forward) deal
    admin = _make_user(db, "admin", "+910000000009", name="A")
    client = _client(db)
    try:
        _as(farmer_user)
        dispute_id = client.post(
            f"/api/deals/{deal.id}/disputes", json={"reason": "Late delivery"},
        ).json()["id"]

        _as(admin)
        resp = client.patch(
            f"/api/disputes/{dispute_id}/close",
            json={"outcome": "favour_farmer", "apply_forward_penalty": True},
        )
        assert resp.status_code == 422, resp.text

        db.expire_all()
        assert db.execute(
            select(Dispute.status).where(Dispute.id == dispute_id)
        ).scalar_one() == "open"
    finally:
        app.dependency_overrides.clear()


def test_forward_penalty_cannot_be_applied_twice(db, farmer_user, buyer_user):
    client = _client(db)
    try:
        deal_id, commitment_id = _seed_forward_deal(client, farmer_user, buyer_user)
        admin = _make_user(db, "admin", "+910000000009", name="A")

        _as(farmer_user)
        first_dispute = client.post(
            f"/api/deals/{deal_id}/disputes", json={"reason": "Buyer defaulted"},
        ).json()["id"]
        _as(admin)
        assert client.patch(
            f"/api/disputes/{first_dispute}/close",
            json={"outcome": "favour_farmer", "apply_forward_penalty": True},
        ).status_code == 200

        # a second dispute can be raised (the first is now resolved, not open)
        # and resolved normally, but the penalty can't be applied again
        _as(buyer_user)
        second_dispute = client.post(
            f"/api/deals/{deal_id}/disputes", json={"reason": "Disputing the ruling"},
        ).json()["id"]
        _as(admin)
        resp = client.patch(
            f"/api/disputes/{second_dispute}/close",
            json={"outcome": "favour_farmer", "apply_forward_penalty": True},
        )
        assert resp.status_code == 409, resp.text

        db.expire_all()
        cm = db.get(ForwardCommitment, commitment_id)
        assert cm.status == "breached"  # unchanged by the second (rejected) attempt
    finally:
        app.dependency_overrides.clear()


def test_breach_does_not_reopen_the_bids_fill_percentage(db, farmer_user, buyer_user):
    """A breached commitment already materialised into a deal — the bid's
    capacity was spoken for. fill_pct/accepted_kg must not drop back to 0 just
    because the commitment was later found breached (that would misleadingly
    suggest the slot is available again)."""
    client = _client(db)
    try:
        deal_id, commitment_id = _seed_forward_deal(client, farmer_user, buyer_user,
                                                     price_per_qtl=7400, quantity_kg=2000)
        admin = _make_user(db, "admin", "+910000000009", name="A")
        bid_id = db.get(ForwardCommitment, commitment_id).bid_id

        _as(farmer_user)
        before = client.get(f"/api/forward/bids/{bid_id}").json()
        assert before["fill_pct"] == 100.0 and before["accepted_kg"] == 2000

        dispute_id = client.post(
            f"/api/deals/{deal_id}/disputes", json={"reason": "Buyer defaulted"},
        ).json()["id"]
        _as(admin)
        assert client.patch(
            f"/api/disputes/{dispute_id}/close",
            json={"outcome": "favour_farmer", "apply_forward_penalty": True},
        ).status_code == 200

        _as(farmer_user)
        after = client.get(f"/api/forward/bids/{bid_id}").json()
        assert after["fill_pct"] == 100.0 and after["accepted_kg"] == 2000
    finally:
        app.dependency_overrides.clear()


def test_regular_dispute_resolution_unaffected_without_the_flag(db, farmer_user, buyer_user):
    """apply_forward_penalty defaults to False — resolving a forward deal's
    dispute the normal way must leave the commitment untouched."""
    client = _client(db)
    try:
        deal_id, commitment_id = _seed_forward_deal(client, farmer_user, buyer_user)
        admin = _make_user(db, "admin", "+910000000009", name="A")

        _as(farmer_user)
        dispute_id = client.post(
            f"/api/deals/{deal_id}/disputes", json={"reason": "Minor disagreement"},
        ).json()["id"]
        _as(admin)
        resp = client.patch(
            f"/api/disputes/{dispute_id}/close", json={"outcome": "dismissed"},
        )
        assert resp.status_code == 200

        db.expire_all()
        cm = db.get(ForwardCommitment, commitment_id)
        assert cm.status == "accepted" and cm.breach_status is None and cm.penalty_inr is None
    finally:
        app.dependency_overrides.clear()
