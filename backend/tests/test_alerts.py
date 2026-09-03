"""Price alerts, notifications, and the ingestion-time alert evaluator (v1.1)."""

from datetime import date

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.price_alert import PriceAlert
from app.models.price_cache import PriceCache
from app.services.alerts import evaluate_alerts


def _as(user):
    app.dependency_overrides[get_current_user] = lambda: user


def _client(db):
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def test_alert_crud_and_ownership(db, farmer_user, buyer_user):
    client = _client(db)
    try:
        _as(farmer_user)
        r = client.post("/api/alerts", json={"crop": "Onion", "market": "Pune", "direction": "above", "threshold": 2000})
        assert r.status_code == 201
        alert_id = r.json()["id"]

        assert len(client.get("/api/alerts").json()) == 1

        # another user cannot see or delete it
        _as(buyer_user)
        assert client.get("/api/alerts").json() == []
        assert client.delete(f"/api/alerts/{alert_id}").status_code == 404

        _as(farmer_user)
        t = client.patch(f"/api/alerts/{alert_id}/toggle")
        assert t.status_code == 200 and t.json()["active"] is False
        assert client.delete(f"/api/alerts/{alert_id}").status_code == 204
        assert client.get("/api/alerts").json() == []
    finally:
        app.dependency_overrides.clear()


def test_alert_validation(db, farmer_user):
    client = _client(db)
    try:
        _as(farmer_user)
        assert client.post("/api/alerts", json={"crop": "Onion", "market": "Pune", "direction": "sideways", "threshold": 5}).status_code == 422
        assert client.post("/api/alerts", json={"crop": "Onion", "market": "Pune", "direction": "above", "threshold": -1}).status_code == 422
        assert client.post("/api/alerts", json={"crop": "Onion", "market": "Pune", "direction": "above", "threshold": 9_999_999_999}).status_code == 422
        assert client.post("/api/alerts", json={"crop": "  ", "market": "Pune", "direction": "above", "threshold": 5}).status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_duplicate_alert_is_rejected(db, farmer_user):
    client = _client(db)
    try:
        _as(farmer_user)
        body = {"crop": "Onion", "market": "Pune", "direction": "above", "threshold": 2000}
        assert client.post("/api/alerts", json=body).status_code == 201
        assert client.post("/api/alerts", json=body).status_code == 409
        # case-only difference is still a duplicate
        assert client.post("/api/alerts", json={**body, "crop": "onion"}).status_code == 409
    finally:
        app.dependency_overrides.clear()


def test_alert_count_is_capped(db, farmer_user):
    from app.api.alerts import _MAX_ALERTS_PER_USER

    for i in range(_MAX_ALERTS_PER_USER):
        db.add(PriceAlert(user_id=farmer_user.id, crop=f"Crop{i}", market="Pune",
                          direction="above", threshold=100 + i, active=True))
    db.commit()
    client = _client(db)
    try:
        _as(farmer_user)
        r = client.post("/api/alerts", json={"crop": "Onion", "market": "Pune",
                                             "direction": "above", "threshold": 2000})
        assert r.status_code == 409
    finally:
        app.dependency_overrides.clear()


def test_evaluate_alerts_matches_case_insensitively(db, farmer_user):
    db.add(PriceAlert(user_id=farmer_user.id, crop="onion", market="pune",
                      direction="above", threshold=1500, active=True))
    db.add(PriceCache(crop="Onion", variety="", market="Pune", district="Pune",
                      state="Maharashtra", date=date(2026, 9, 1),
                      min_price=1800, max_price=2100, modal_price=2000, arrival_volume=None))
    db.commit()
    assert evaluate_alerts(db) == 1


def test_notifications_respect_limit(db, farmer_user):
    from app.models.notification import Notification

    for i in range(10):
        db.add(Notification(user_id=farmer_user.id, kind="system", title=f"n{i}", body=""))
    db.commit()
    client = _client(db)
    try:
        _as(farmer_user)
        assert len(client.get("/api/notifications", params={"limit": 4}).json()) == 4
    finally:
        app.dependency_overrides.clear()


def test_evaluate_alerts_creates_notification(db, farmer_user):
    db.add(PriceAlert(user_id=farmer_user.id, crop="Onion", market="Pune",
                      direction="above", threshold=1500, active=True))
    db.add(PriceCache(crop="Onion", variety="", market="Pune", district="Pune",
                      state="Maharashtra", date=date(2026, 9, 1),
                      min_price=1800, max_price=2100, modal_price=2000, arrival_volume=None))
    db.commit()

    created = evaluate_alerts(db)
    assert created == 1
    # de-bounced on the second run
    assert evaluate_alerts(db) == 0

    client = _client(db)
    try:
        _as(farmer_user)
        notifs = client.get("/api/notifications").json()
        assert len(notifs) == 1 and notifs[0]["kind"] == "price_alert"
        assert client.get("/api/notifications/unread-count").json()["unread"] == 1
        nid = notifs[0]["id"]
        assert client.patch(f"/api/notifications/{nid}/read").json()["read"] is True
        assert client.get("/api/notifications/unread-count").json()["unread"] == 0
    finally:
        app.dependency_overrides.clear()


def test_evaluate_alerts_below_direction(db, buyer_user):
    db.add(PriceAlert(user_id=buyer_user.id, crop="Tur", market="Latur",
                      direction="below", threshold=7000, active=True))
    db.add(PriceCache(crop="Tur", variety="", market="Latur", district="Latur",
                      state="Maharashtra", date=date(2026, 9, 1),
                      min_price=6200, max_price=6800, modal_price=6500, arrival_volume=None))
    db.commit()
    assert evaluate_alerts(db) == 1


def test_inactive_alert_does_not_fire(db, farmer_user):
    db.add(PriceAlert(user_id=farmer_user.id, crop="Onion", market="Pune",
                      direction="above", threshold=100, active=False))
    db.add(PriceCache(crop="Onion", variety="", market="Pune", district="Pune",
                      state="Maharashtra", date=date(2026, 9, 1),
                      min_price=1800, max_price=2100, modal_price=2000, arrival_volume=None))
    db.commit()
    assert evaluate_alerts(db) == 0
