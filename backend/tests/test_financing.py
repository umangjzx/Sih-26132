"""Warehouse-receipt-backed financing requests (v1.17).

The platform holds no money — this is a request-tracking workflow (create,
withdraw, admin approve/reject), same self-reported pattern as account
verification. No real disbursement anywhere in this feature.
"""

from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.lot import Lot


def _client(db):
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _as(user):
    app.dependency_overrides[get_current_user] = lambda: user


def _make_lot(db, farmer_id, *, crop="Onion", quantity_kg=1000, expected_price=2000, status="open"):
    lot = Lot(
        farmer_id=farmer_id, crop=crop, quantity_kg=quantity_kg, quality_grade="FAQ",
        expected_price=expected_price, available_from=date.today(), location="Pune",
        status=status,
    )
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return lot


def test_farmer_creates_financing_request(db, farmer_user):
    lot = _make_lot(db, farmer_user.id, quantity_kg=1000, expected_price=2000)  # value = 20,000
    c = _client(db)
    try:
        _as(farmer_user)
        r = c.post("/api/financing/requests", json={
            "lot_id": lot.id, "requested_amount_inr": 10000,
            "warehouse_name": "Lasalgaon Onion Cold Store", "receipt_ref": "WR-1234",
        })
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["status"] == "pending"
        assert body["crop"] == "Onion"
        assert body["max_eligible_inr"] == 15000  # 75% of 20,000
    finally:
        app.dependency_overrides.clear()


def test_request_exceeding_loan_to_value_cap_rejected(db, farmer_user):
    lot = _make_lot(db, farmer_user.id, quantity_kg=1000, expected_price=2000)  # value = 20,000, cap 15,000
    c = _client(db)
    try:
        _as(farmer_user)
        r = c.post("/api/financing/requests", json={"lot_id": lot.id, "requested_amount_inr": 18000})
        assert r.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_cannot_pledge_someone_elses_lot(db, farmer_user, buyer_user):
    lot = _make_lot(db, buyer_user.id)  # not owned by farmer_user
    c = _client(db)
    try:
        _as(farmer_user)
        r = c.post("/api/financing/requests", json={"lot_id": lot.id, "requested_amount_inr": 1000})
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_cannot_pledge_a_matched_lot(db, farmer_user):
    lot = _make_lot(db, farmer_user.id, status="matched")
    c = _client(db)
    try:
        _as(farmer_user)
        r = c.post("/api/financing/requests", json={"lot_id": lot.id, "requested_amount_inr": 1000})
        assert r.status_code == 409
    finally:
        app.dependency_overrides.clear()


def test_cannot_double_pledge_the_same_lot(db, farmer_user):
    lot = _make_lot(db, farmer_user.id, quantity_kg=1000, expected_price=2000)
    c = _client(db)
    try:
        _as(farmer_user)
        r1 = c.post("/api/financing/requests", json={"lot_id": lot.id, "requested_amount_inr": 5000})
        assert r1.status_code == 201
        r2 = c.post("/api/financing/requests", json={"lot_id": lot.id, "requested_amount_inr": 3000})
        assert r2.status_code == 409
    finally:
        app.dependency_overrides.clear()


def test_farmer_can_withdraw_own_pending_request(db, farmer_user):
    lot = _make_lot(db, farmer_user.id, quantity_kg=1000, expected_price=2000)
    c = _client(db)
    try:
        _as(farmer_user)
        rid = c.post("/api/financing/requests", json={"lot_id": lot.id, "requested_amount_inr": 5000}).json()["id"]
        r = c.post(f"/api/financing/requests/{rid}/withdraw")
        assert r.status_code == 200 and r.json()["status"] == "withdrawn"

        # withdrawing frees the lot up for a fresh request
        r2 = c.post("/api/financing/requests", json={"lot_id": lot.id, "requested_amount_inr": 4000})
        assert r2.status_code == 201
    finally:
        app.dependency_overrides.clear()


def test_farmer_cannot_withdraw_someone_elses_request(db, farmer_user, buyer_user):
    lot = _make_lot(db, farmer_user.id, quantity_kg=1000, expected_price=2000)
    c = _client(db)
    try:
        _as(farmer_user)
        rid = c.post("/api/financing/requests", json={"lot_id": lot.id, "requested_amount_inr": 5000}).json()["id"]
        _as(buyer_user)
        assert c.post(f"/api/financing/requests/{rid}/withdraw").status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_farmer_sees_only_own_requests(db, farmer_user, buyer_user, admin_user):
    lot_a = _make_lot(db, farmer_user.id, quantity_kg=1000, expected_price=2000)
    c = _client(db)
    try:
        _as(farmer_user)
        c.post("/api/financing/requests", json={"lot_id": lot_a.id, "requested_amount_inr": 5000})
        r = c.get("/api/financing/requests/mine")
        assert r.status_code == 200 and len(r.json()) == 1
    finally:
        app.dependency_overrides.clear()


def test_admin_approves_a_request(db, farmer_user, admin_user):
    lot = _make_lot(db, farmer_user.id, quantity_kg=1000, expected_price=2000)
    c = _client(db)
    try:
        _as(farmer_user)
        rid = c.post("/api/financing/requests", json={"lot_id": lot.id, "requested_amount_inr": 5000}).json()["id"]

        _as(admin_user)
        r = c.patch(f"/api/financing/requests/{rid}", json={"status": "approved", "admin_note": "Verified receipt."})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "approved"
        assert body["reviewed_by"] == admin_user.id and body["reviewed_at"]

        # already reviewed -> 409 on a second attempt
        r2 = c.patch(f"/api/financing/requests/{rid}", json={"status": "rejected"})
        assert r2.status_code == 409
    finally:
        app.dependency_overrides.clear()


def test_admin_rejects_a_request(db, farmer_user, admin_user):
    lot = _make_lot(db, farmer_user.id, quantity_kg=1000, expected_price=2000)
    c = _client(db)
    try:
        _as(farmer_user)
        rid = c.post("/api/financing/requests", json={"lot_id": lot.id, "requested_amount_inr": 5000}).json()["id"]
        _as(admin_user)
        r = c.patch(f"/api/financing/requests/{rid}", json={"status": "rejected", "admin_note": "No receipt attached."})
        assert r.status_code == 200 and r.json()["status"] == "rejected"
    finally:
        app.dependency_overrides.clear()


def test_non_admin_cannot_list_all_or_review(db, farmer_user):
    c = _client(db)
    try:
        _as(farmer_user)
        assert c.get("/api/financing/requests").status_code == 403
        assert c.patch("/api/financing/requests/1", json={"status": "approved"}).status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_admin_list_filters_by_status(db, farmer_user, admin_user):
    lot1 = _make_lot(db, farmer_user.id, quantity_kg=1000, expected_price=2000)
    lot2 = _make_lot(db, farmer_user.id, crop="Tomato", quantity_kg=1000, expected_price=2000)
    c = _client(db)
    try:
        _as(farmer_user)
        r1 = c.post("/api/financing/requests", json={"lot_id": lot1.id, "requested_amount_inr": 5000}).json()["id"]
        c.post("/api/financing/requests", json={"lot_id": lot2.id, "requested_amount_inr": 4000})

        _as(admin_user)
        c.patch(f"/api/financing/requests/{r1}", json={"status": "approved"})

        pending = c.get("/api/financing/requests", params={"status": "pending"}).json()
        approved = c.get("/api/financing/requests", params={"status": "approved"}).json()
        assert len(pending) == 1 and pending[0]["crop"] == "Tomato"
        assert len(approved) == 1 and approved[0]["crop"] == "Onion"
    finally:
        app.dependency_overrides.clear()


def test_buyer_cannot_create_financing_request(db, buyer_user):
    c = _client(db)
    try:
        _as(buyer_user)
        r = c.post("/api/financing/requests", json={"lot_id": 1, "requested_amount_inr": 1000})
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()
