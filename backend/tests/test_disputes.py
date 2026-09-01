"""Tests for the dispute endpoints (Phase 3).

Reuses ``_seed_deal`` / ``_as`` / ``_client`` / ``_make_user`` from
``tests.test_deals`` to build the underlying lot + demand + match + deal.
"""

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.dispute import Dispute

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
        resp = client.patch(f"/api/disputes/{dispute_id}/close")
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "closed"

        # already closed -> 400
        resp2 = client.patch(f"/api/disputes/{dispute_id}/close")
        assert resp2.status_code == 400

        db.expire_all()
        row = db.execute(
            select(Dispute).where(Dispute.id == dispute_id)
        ).scalar_one()
        assert row.status == "closed"
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
