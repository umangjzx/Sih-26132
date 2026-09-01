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
