"""Forward contracts (v1.6 #3) — pre-harvest bid + commitment + materialise."""

from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.deal import Deal
from app.models.forward import ForwardBid, ForwardCommitment


def _client(db):
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _as(user):
    app.dependency_overrides[get_current_user] = lambda: user


_FROM = (date.today() + timedelta(days=40)).isoformat()
_TO = (date.today() + timedelta(days=70)).isoformat()


def _bid_body(**over):
    b = {
        "crop": "Tur", "quantity_kg": 5000, "price_min": 7000, "price_max": 7800,
        "delivery_from": _FROM, "delivery_to": _TO, "quality_grade_min": "FAQ",
    }
    b.update(over)
    return b


def _make_bid(client, buyer, **over):
    _as(buyer)
    r = client.post("/api/forward/bids", json=_bid_body(**over))
    assert r.status_code == 201, r.text
    return r.json()


def test_buyer_creates_bid_farmer_commits(db, farmer_user, buyer_user):
    c = _client(db)
    try:
        bid = _make_bid(c, buyer_user)
        assert bid["remaining_kg"] == 5000
        assert bid["harvest_window"]  # Tur is in the crop calendar

        _as(farmer_user)
        r = c.post(f"/api/forward/bids/{bid['id']}/commitments", json={
            "quantity_kg": 2000, "price_per_qtl": 7400,
            "expected_ready": (date.today() + timedelta(days=55)).isoformat(),
        })
        assert r.status_code == 201, r.text
        assert r.json()["status"] == "pending"

        # farmer now sees their own commitment on the bid
        r = c.get("/api/forward/bids", params={"crop": "Tur"})
        row = r.json()[0]
        assert row["my_commitment"]["quantity_kg"] == 2000
        assert row["committed_kg"] == 2000 and row["accepted_kg"] == 0
    finally:
        app.dependency_overrides.clear()


def test_commit_price_outside_band_rejected(db, farmer_user, buyer_user):
    c = _client(db)
    try:
        bid = _make_bid(c, buyer_user)
        _as(farmer_user)
        r = c.post(f"/api/forward/bids/{bid['id']}/commitments", json={
            "quantity_kg": 1000, "price_per_qtl": 9000,
            "expected_ready": _FROM,
        })
        assert r.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_farmer_cannot_create_bid(db, farmer_user):
    c = _client(db)
    try:
        _as(farmer_user)
        r = c.post("/api/forward/bids", json=_bid_body())
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_accept_commitment_materialises_a_deal(db, farmer_user, buyer_user):
    c = _client(db)
    try:
        bid = _make_bid(c, buyer_user, quantity_kg=2000)
        _as(farmer_user)
        cm = c.post(f"/api/forward/bids/{bid['id']}/commitments", json={
            "quantity_kg": 2000, "price_per_qtl": 7400,
            "expected_ready": (date.today() + timedelta(days=55)).isoformat(),
        }).json()

        _as(buyer_user)
        r = c.post(f"/api/forward/commitments/{cm['id']}/accept")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "accepted" and body["deal_id"]

        deal = db.get(Deal, body["deal_id"])
        assert deal.agreed_price == 7400 and deal.agreed_quantity == 2000
        assert deal.pipeline_status == "matched"

        # bid fully covered -> filled
        db.expire_all()
        assert db.get(ForwardBid, bid["id"]).status == "filled"
    finally:
        app.dependency_overrides.clear()


def test_only_bid_buyer_can_accept(db, farmer_user, buyer_user, admin_user):
    c = _client(db)
    try:
        bid = _make_bid(c, buyer_user)
        _as(farmer_user)
        cm = c.post(f"/api/forward/bids/{bid['id']}/commitments", json={
            "quantity_kg": 1000, "price_per_qtl": 7200, "expected_ready": _FROM,
        }).json()
        _as(admin_user)
        r = c.post(f"/api/forward/commitments/{cm['id']}/accept")
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_double_active_commitment_blocked_then_withdraw(db, farmer_user, buyer_user):
    c = _client(db)
    try:
        bid = _make_bid(c, buyer_user)
        _as(farmer_user)
        first = c.post(f"/api/forward/bids/{bid['id']}/commitments", json={
            "quantity_kg": 1000, "price_per_qtl": 7200, "expected_ready": _FROM,
        }).json()
        r = c.post(f"/api/forward/bids/{bid['id']}/commitments", json={
            "quantity_kg": 500, "price_per_qtl": 7300, "expected_ready": _FROM,
        })
        assert r.status_code == 409
        r = c.post(f"/api/forward/commitments/{first['id']}/withdraw")
        assert r.status_code == 200 and r.json()["status"] == "withdrawn"
        # now a new commitment is allowed
        r = c.post(f"/api/forward/bids/{bid['id']}/commitments", json={
            "quantity_kg": 500, "price_per_qtl": 7300, "expected_ready": _FROM,
        })
        assert r.status_code == 201
    finally:
        app.dependency_overrides.clear()


def test_calendar_warning_on_off_season_ready_date(db, farmer_user, buyer_user):
    c = _client(db)
    try:
        # Tur harvests Nov-Jan; pick a ready date in June
        june = date(date.today().year + 1, 6, 15)
        bid = _make_bid(
            c, buyer_user,
            delivery_from=june.isoformat(),
            delivery_to=(june + timedelta(days=30)).isoformat(),
        )
        _as(farmer_user)
        cm = c.post(f"/api/forward/bids/{bid['id']}/commitments", json={
            "quantity_kg": 1000, "price_per_qtl": 7200,
            "expected_ready": june.isoformat(),
        }).json()
        assert cm["calendar_warning"] and "harvest" in cm["calendar_warning"].lower()
    finally:
        app.dependency_overrides.clear()


def test_commit_over_bid_quantity_blocked(db, farmer_user, buyer_user):
    c = _client(db)
    try:
        bid = _make_bid(c, buyer_user, quantity_kg=1000)
        _as(farmer_user)
        # a single commitment larger than the whole bid is rejected
        r = c.post(f"/api/forward/bids/{bid['id']}/commitments", json={
            "quantity_kg": 4000, "price_per_qtl": 7200, "expected_ready": _FROM,
        })
        assert r.status_code == 409
        # a valid one, accepted, fills the bid -> further commitments are refused
        r = c.post(f"/api/forward/bids/{bid['id']}/commitments", json={
            "quantity_kg": 1000, "price_per_qtl": 7200, "expected_ready": _FROM,
        })
        assert r.status_code == 201
        cm = r.json()
        _as(buyer_user)
        assert c.post(f"/api/forward/commitments/{cm['id']}/accept").status_code == 200
        _as(farmer_user)
        r = c.post(f"/api/forward/bids/{bid['id']}/commitments", json={
            "quantity_kg": 200, "price_per_qtl": 7200, "expected_ready": _FROM,
        })
        assert r.status_code == 409  # bid is filled
    finally:
        app.dependency_overrides.clear()
