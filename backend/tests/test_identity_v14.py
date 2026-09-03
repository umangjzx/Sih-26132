"""v1.4 — profile location on the account, buyer verification workflow,
admin user management, and the distance veto in matching.
"""

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.models.user import User


def _client(db):
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _as(user):
    app.dependency_overrides[get_current_user] = lambda: user


# --------------------------------------------------------------------------- #
# profile
# --------------------------------------------------------------------------- #

def test_patch_me_sets_location(db, farmer_user):
    client = _client(db)
    try:
        _as(farmer_user)
        r = client.patch("/api/auth/me", json={
            "district": "Coimbatore", "state": "Tamil Nadu",
            "latitude": 11.0168, "longitude": 76.9558,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["district"] == "Coimbatore"
        assert body["latitude"] == 11.0168 and body["longitude"] == 76.9558
        db.refresh(farmer_user)
        assert farmer_user.state == "Tamil Nadu"
    finally:
        app.dependency_overrides.clear()


def test_patch_me_rejects_half_a_coordinate(db, farmer_user):
    client = _client(db)
    try:
        _as(farmer_user)
        assert client.patch("/api/auth/me", json={"latitude": 11.0}).status_code == 422
    finally:
        app.dependency_overrides.clear()


# --------------------------------------------------------------------------- #
# verification workflow
# --------------------------------------------------------------------------- #

def test_verification_request_then_admin_verifies(db, buyer_user, admin_user):
    client = _client(db)
    try:
        _as(buyer_user)
        r = client.post("/api/auth/me/request-verification", json={"note": "GST 27ABC", "reference": "GST27ABC"})
        assert r.status_code == 200
        assert r.json()["verification_status"] == "pending"

        _as(admin_user)
        lst = client.get("/api/admin/users", params={"verification": "pending"}).json()
        assert any(u["id"] == buyer_user.id for u in lst)

        r = client.patch(f"/api/admin/users/{buyer_user.id}/verify", json={"status": "verified"})
        assert r.status_code == 200
        assert r.json()["verification_status"] == "verified"
        db.refresh(buyer_user)
        assert buyer_user.kyc_status == "verified" and buyer_user.verified_by == admin_user.id
    finally:
        app.dependency_overrides.clear()


def test_admin_verify_rejects_non_admin(db, farmer_user, buyer_user):
    client = _client(db)
    try:
        _as(farmer_user)
        assert client.patch(f"/api/admin/users/{buyer_user.id}/verify", json={"status": "verified"}).status_code == 403
        assert client.get("/api/admin/users").status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_admin_users_list_counts(db, admin_user, farmer_user, buyer_user):
    lot = Lot(farmer_id=farmer_user.id, crop="Onion", quantity_kg=500, quality_grade="A",
              expected_price=2400, available_from=date(2026, 10, 1), location="Pune", status="open")
    dem = Demand(buyer_id=buyer_user.id, crop="Onion", quantity_kg=500, quality_spec="A",
                 price_band_min=2000, price_band_max=2800, delivery_window="7 days", status="open")
    db.add_all([lot, dem]); db.commit()
    client = _client(db)
    try:
        _as(admin_user)
        rows = {u["id"]: u for u in client.get("/api/admin/users").json()}
        assert rows[farmer_user.id]["lots"] == 1
        assert rows[buyer_user.id]["demands"] == 1
    finally:
        app.dependency_overrides.clear()


def test_admin_cannot_deactivate_self(db, admin_user):
    client = _client(db)
    try:
        _as(admin_user)
        assert client.patch(f"/api/admin/users/{admin_user.id}/active", json={"is_active": False}).status_code == 400
    finally:
        app.dependency_overrides.clear()


def test_admin_user_actions_are_audit_logged(db, admin_user, buyer_user):
    from app.models.transaction_event import TransactionEvent

    client = _client(db)
    try:
        _as(admin_user)
        client.patch(f"/api/admin/users/{buyer_user.id}/verify", json={"status": "verified"})
        client.patch(f"/api/admin/users/{buyer_user.id}/active", json={"is_active": False})
    finally:
        app.dependency_overrides.clear()

    actions = {
        e.action for e in db.execute(
            select(TransactionEvent).where(
                TransactionEvent.entity_type == "user",
                TransactionEvent.entity_id == buyer_user.id,
            )
        ).scalars().all()
    }
    assert "admin_verification_changed" in actions
    assert "admin_user_deactivated" in actions


def test_admin_events_csv_neutralises_formula_injection(db, buyer_user):
    # an admin whose display name is a spreadsheet formula acts on another user;
    # their name lands in the CSV's actor_name column and must be neutralised.
    evil_admin = User(role="admin", name='=HYPERLINK("http://evil")', phone="+91evilcsv",
                      district="Pune", taluka="")
    db.add(evil_admin); db.commit()
    client = _client(db)
    try:
        _as(evil_admin)
        client.patch(f"/api/admin/users/{buyer_user.id}/active", json={"is_active": False})
        csv_text = client.get("/api/admin/events.csv").text
    finally:
        app.dependency_overrides.clear()
    # the escaped form is present; the formula never starts a bare cell
    assert "'=HYPERLINK" in csv_text
    assert ",=HYPERLINK" not in csv_text


# --------------------------------------------------------------------------- #
# demand location + distance veto
# --------------------------------------------------------------------------- #

def test_demand_inherits_buyer_location(db, buyer_user):
    buyer_user.district = "Coimbatore"
    buyer_user.latitude = 11.0168
    buyer_user.longitude = 76.9558
    db.commit()
    client = _client(db)
    try:
        _as(buyer_user)
        r = client.post("/api/demands/", json={
            "crop": "Onion", "quantity_kg": 500, "quality_spec": "A",
            "price_band_min": 2000, "price_band_max": 2800, "delivery_window": "7 days",
        })
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["delivery_district"] == "Coimbatore"
        assert body["latitude"] == 11.0168
    finally:
        app.dependency_overrides.clear()


def test_matching_vetoes_far_pairs(db, farmer_user, buyer_user):
    # farmer's lot in Pune, buyer wants delivery in Guwahati (~1800 km) -> no match
    farmer_user.district = "Pune"; farmer_user.latitude = 18.52; farmer_user.longitude = 73.86
    buyer_user.district = "Kamrup"; buyer_user.latitude = 26.16; buyer_user.longitude = 91.74
    db.add_all([
        Lot(farmer_id=farmer_user.id, crop="Onion", quantity_kg=500, quality_grade="A",
            expected_price=2400, available_from=date(2026, 10, 1), location="Pune",
            latitude=18.52, longitude=73.86, status="open"),
        Demand(buyer_id=buyer_user.id, crop="Onion", quantity_kg=500, quality_spec="A",
               price_band_min=2000, price_band_max=2800, delivery_window="7 days",
               delivery_district="Kamrup", latitude=26.16, longitude=91.74, status="open"),
    ])
    db.commit()
    from app.services.matching import run_matching
    run_matching(db)
    assert db.query(Match).count() == 0

    # move the buyer's delivery point next to the lot -> now it matches
    d = db.query(Demand).one()
    d.delivery_district = "Pune"; d.latitude = 18.52; d.longitude = 73.86
    db.commit()
    run_matching(db)
    assert db.query(Match).count() == 1
