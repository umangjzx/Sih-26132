"""Tests for the demand endpoints (POST /, GET /mine)."""

import pytest

DEMAND_BODY = {
    "crop": "Onion",
    "quantity_kg": 700.0,
    "quality_spec": "Grade A, no blemishes",
    "price_band_min": 2000.0,
    "price_band_max": 2800.0,
    "delivery_window": "Within 7 days",
}


# ---------------------------------------------------------------------------
# POST /api/demands/
# ---------------------------------------------------------------------------

def test_create_demand_buyer_ok(buyer_client):
    resp = buyer_client.post("/api/demands/", json=DEMAND_BODY)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["crop"] == "Onion"
    assert data["status"] == "open"


def test_create_demand_farmer_forbidden(farmer_client):
    resp = farmer_client.post("/api/demands/", json=DEMAND_BODY)
    assert resp.status_code == 403


def test_create_demand_no_auth(auth_client):
    resp = auth_client.post("/api/demands/", json=DEMAND_BODY)
    assert resp.status_code == 401


def test_create_demand_zero_quantity_rejected(buyer_client):
    body = {**DEMAND_BODY, "quantity_kg": 0}
    resp = buyer_client.post("/api/demands/", json=body)
    assert resp.status_code == 422


def test_create_demand_price_band_inverted(buyer_client):
    body = {**DEMAND_BODY, "price_band_min": 3000.0, "price_band_max": 1000.0}
    resp = buyer_client.post("/api/demands/", json=body)
    assert resp.status_code == 422


def test_create_demand_zero_min_price_rejected(buyer_client):
    body = {**DEMAND_BODY, "price_band_min": 0}
    resp = buyer_client.post("/api/demands/", json=body)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/demands/mine
# ---------------------------------------------------------------------------

def test_list_my_demands_own_only(buyer_client, buyer_user):
    buyer_client.post("/api/demands/", json=DEMAND_BODY)
    resp = buyer_client.get("/api/demands/mine")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert all(d["buyer_id"] == buyer_user.id for d in data)


def test_list_my_demands_farmer_forbidden(farmer_client):
    resp = farmer_client.get("/api/demands/mine")
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# PATCH / DELETE  (edit + withdraw a still-open demand)
# ---------------------------------------------------------------------------

def test_update_own_open_demand(buyer_client):
    did = buyer_client.post("/api/demands/", json=DEMAND_BODY).json()["id"]
    resp = buyer_client.patch(f"/api/demands/{did}", json={"price_band_min": 2500, "price_band_max": 3200})
    assert resp.status_code == 200, resp.text
    b = resp.json()
    assert b["price_band_min"] == 2500 and b["price_band_max"] == 3200


def test_update_demand_inverted_band_rejected(buyer_client):
    did = buyer_client.post("/api/demands/", json=DEMAND_BODY).json()["id"]
    # only the max, pushing it below the stored min
    resp = buyer_client.patch(f"/api/demands/{did}", json={"price_band_max": 1})
    assert resp.status_code == 422


def test_withdraw_own_open_demand(buyer_client, db):
    from app.models.demand import Demand
    did = buyer_client.post("/api/demands/", json=DEMAND_BODY).json()["id"]
    assert buyer_client.delete(f"/api/demands/{did}").status_code == 200
    db.expire_all()
    assert db.get(Demand, did).status == "closed"


def test_cannot_edit_matched_demand(buyer_client, db):
    from app.models.demand import Demand
    did = buyer_client.post("/api/demands/", json=DEMAND_BODY).json()["id"]
    db.get(Demand, did).status = "matched"
    db.commit()
    assert buyer_client.patch(f"/api/demands/{did}", json={"price_band_min": 2500}).status_code == 409
