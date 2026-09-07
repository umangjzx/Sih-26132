"""Admin listings/demands moderation + the full disputes history (v1.18).

Closes a real gap: previously an admin had no way to inspect or act on a
single lot/demand directly, and the dashboard's dispute_queue only ever
showed 'open' disputes.
"""

from datetime import date

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.demand import Demand
from app.models.dispute import Dispute
from app.models.lot import Lot

from tests.test_deals import _as, _client, _seed_deal


def _seed_lot(db, farmer_user, *, crop="Onion", status="open"):
    lot = Lot(
        farmer_id=farmer_user.id, crop=crop, quantity_kg=500, quality_grade="A",
        expected_price=2400, available_from=date(2026, 10, 1),
        location="Pune", status=status,
    )
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return lot


def _seed_demand(db, buyer_user, *, crop="Onion", status="open"):
    demand = Demand(
        buyer_id=buyer_user.id, crop=crop, quantity_kg=600, quality_spec="Grade A",
        price_band_min=2000, price_band_max=2800, delivery_window="7 days",
        status=status,
    )
    db.add(demand)
    db.commit()
    db.refresh(demand)
    return demand


# ---------------------------------------------------------------------------
# GET /api/admin/lots
# ---------------------------------------------------------------------------

def test_admin_list_lots_requires_admin(db, farmer_user):
    client = _client(db)
    try:
        _as(farmer_user)
        assert client.get("/api/admin/lots").status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_admin_list_lots_returns_farmer_name_and_filters(db, admin_user, farmer_user):
    _seed_lot(db, farmer_user, crop="Onion")
    _seed_lot(db, farmer_user, crop="Tomato", status="closed")
    client = _client(db)
    try:
        _as(admin_user)
        r = client.get("/api/admin/lots")
        assert r.status_code == 200
        body = r.json()
        assert len(body) == 2
        assert body[0]["farmer_name"] == farmer_user.name

        r2 = client.get("/api/admin/lots", params={"status": "open"})
        assert len(r2.json()) == 1
        assert r2.json()[0]["crop"] == "Onion"

        r3 = client.get("/api/admin/lots", params={"q": farmer_user.name})
        assert len(r3.json()) == 2
    finally:
        app.dependency_overrides.clear()


def test_admin_close_lot(db, admin_user, farmer_user):
    lot = _seed_lot(db, farmer_user)
    client = _client(db)
    try:
        _as(admin_user)
        r = client.patch(f"/api/admin/lots/{lot.id}/close", json={"reason": "Duplicate listing"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "closed"

        # already closed -> 409
        r2 = client.patch(f"/api/admin/lots/{lot.id}/close", json={"reason": "Duplicate listing"})
        assert r2.status_code == 409
    finally:
        app.dependency_overrides.clear()


def test_admin_close_lot_rejects_short_reason(db, admin_user, farmer_user):
    lot = _seed_lot(db, farmer_user)
    client = _client(db)
    try:
        _as(admin_user)
        r = client.patch(f"/api/admin/lots/{lot.id}/close", json={"reason": "x"})
        assert r.status_code == 422
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# GET /api/admin/demands
# ---------------------------------------------------------------------------

def test_admin_list_demands_and_close(db, admin_user, buyer_user):
    demand = _seed_demand(db, buyer_user)
    client = _client(db)
    try:
        _as(admin_user)
        r = client.get("/api/admin/demands")
        assert r.status_code == 200
        assert r.json()[0]["buyer_name"] == buyer_user.name

        r2 = client.patch(f"/api/admin/demands/{demand.id}/close", json={"reason": "Spam listing"})
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "closed"
    finally:
        app.dependency_overrides.clear()


def test_admin_demands_forbidden_for_buyer(db, buyer_user):
    client = _client(db)
    try:
        _as(buyer_user)
        assert client.get("/api/admin/demands").status_code == 403
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# GET /api/admin/disputes
# ---------------------------------------------------------------------------

def test_admin_list_disputes_includes_every_status(db, admin_user, farmer_user, buyer_user):
    deal1 = _seed_deal(db, farmer_user, buyer_user, crop="Onion")
    deal2 = _seed_deal(db, farmer_user, buyer_user, crop="Tomato")
    db.add(Dispute(deal_id=deal1.id, raised_by=farmer_user.id, reason="Still open", status="open"))
    db.add(Dispute(
        deal_id=deal2.id, raised_by=buyer_user.id, reason="Resolved already",
        status="resolved", outcome="dismissed", resolved_by=admin_user.id,
    ))
    db.commit()

    client = _client(db)
    try:
        _as(admin_user)
        r = client.get("/api/admin/disputes")
        assert r.status_code == 200
        body = r.json()
        assert len(body) == 2
        statuses = {d["status"] for d in body}
        assert statuses == {"open", "resolved"}
        resolved = next(d for d in body if d["status"] == "resolved")
        assert resolved["raised_by_name"] == buyer_user.name
        assert resolved["resolved_by_name"] == admin_user.name
        assert resolved["outcome"] == "dismissed"

        r2 = client.get("/api/admin/disputes", params={"status": "open"})
        assert len(r2.json()) == 1
        assert r2.json()[0]["reason"] == "Still open"
    finally:
        app.dependency_overrides.clear()


def test_admin_disputes_requires_admin(db, farmer_user):
    client = _client(db)
    try:
        _as(farmer_user)
        assert client.get("/api/admin/disputes").status_code == 403
    finally:
        app.dependency_overrides.clear()
