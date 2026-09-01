"""Tests for the lot endpoints (POST /, GET /mine, GET /{id})."""

from datetime import date

import pytest
from sqlalchemy import select

from app.models.lot import Lot
from app.models.user import User

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

LOT_BODY = {
    "crop": "Onion",
    "quantity_kg": 500.0,
    "quality_grade": "A",
    "expected_price": 2400.0,
    "available_from": "2026-10-01",
    "location": "Pune",
}


def _make_farmer(db, phone="+910000000099") -> User:
    u = User(role="farmer", name="Extra Farmer", phone=phone,
             district="Pune", taluka="Haveli", is_active=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


# ---------------------------------------------------------------------------
# POST /api/lots/
# ---------------------------------------------------------------------------

def test_create_lot_farmer_ok(farmer_client, db):
    resp = farmer_client.post("/api/lots/", json=LOT_BODY)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["crop"] == "Onion"
    assert data["status"] == "open"
    # Row exists in DB
    lot = db.execute(select(Lot).where(Lot.id == data["id"])).scalar_one_or_none()
    assert lot is not None


def test_create_lot_buyer_forbidden(buyer_client):
    resp = buyer_client.post("/api/lots/", json=LOT_BODY)
    assert resp.status_code == 403


def test_create_lot_no_auth(auth_client):
    resp = auth_client.post("/api/lots/", json=LOT_BODY)
    assert resp.status_code == 401


def test_create_lot_zero_quantity_rejected(farmer_client):
    body = {**LOT_BODY, "quantity_kg": 0}
    resp = farmer_client.post("/api/lots/", json=body)
    assert resp.status_code == 422


def test_create_lot_zero_price_rejected(farmer_client):
    body = {**LOT_BODY, "expected_price": 0}
    resp = farmer_client.post("/api/lots/", json=body)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/lots/mine
# ---------------------------------------------------------------------------

def test_list_my_lots_returns_own_only(db, farmer_user, farmer_client):
    # Create a second farmer and insert a lot directly into DB for them
    other = _make_farmer(db, phone="+910000000098")
    db.add(Lot(farmer_id=other.id, crop="Tomato", quantity_kg=200,
               quality_grade="B", expected_price=1800, location="Nashik",
               available_from=date(2026, 10, 1), status="open"))
    db.commit()

    # Create one lot via the API as farmer_user
    farmer_client.post("/api/lots/", json=LOT_BODY)

    resp = farmer_client.get("/api/lots/mine")
    assert resp.status_code == 200
    ids = [l["farmer_id"] for l in resp.json()]
    assert all(fid == farmer_user.id for fid in ids)
    assert len(ids) >= 1


def test_list_my_lots_buyer_forbidden(buyer_client):
    resp = buyer_client.get("/api/lots/mine")
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/lots/{id}
# ---------------------------------------------------------------------------

def test_get_lot_by_owner(farmer_client):
    created = farmer_client.post("/api/lots/", json=LOT_BODY).json()
    resp = farmer_client.get(f"/api/lots/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_lot_not_found(farmer_client):
    resp = farmer_client.get("/api/lots/99999")
    assert resp.status_code == 404


def test_get_lot_unrelated_buyer_forbidden(db, farmer_user, buyer_user):
    """Buyer with no match on the lot cannot view it."""
    from fastapi.testclient import TestClient
    from app.core.database import get_db
    from app.core.security import get_current_user
    from app.main import app

    # Create lot as farmer
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: farmer_user
    fc = TestClient(app)
    created = fc.post("/api/lots/", json=LOT_BODY).json()
    assert "id" in created

    # Attempt to view as buyer (no matching demand → no match → 403)
    app.dependency_overrides[get_current_user] = lambda: buyer_user
    bc = TestClient(app)
    resp = bc.get(f"/api/lots/{created['id']}")
    app.dependency_overrides.clear()

    assert resp.status_code == 403
