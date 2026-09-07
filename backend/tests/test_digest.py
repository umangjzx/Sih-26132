"""Opt-in SMS digest (v1.14) — see app/services/digest.py."""

from datetime import datetime, timedelta, timezone

from app.models.notification import Notification
from app.models.user import User
from app.services.digest import send_sms_digests


def _notify(db, user_id, title, *, read=False):
    n = Notification(user_id=user_id, kind="price_alert", title=title, body="", read=read)
    db.add(n)
    db.commit()
    return n


def test_no_digest_when_not_opted_in(db, farmer_user, monkeypatch):
    _notify(db, farmer_user.id, "Onion crossed ₹2000")
    calls = []
    monkeypatch.setattr("app.services.digest.send_sms", lambda phone, msg: calls.append((phone, msg)) or True)

    assert send_sms_digests(db) == 0
    assert calls == []


def test_digest_sent_for_opted_in_user_with_unread(db, farmer_user, monkeypatch):
    farmer_user.sms_digest_enabled = True
    db.commit()
    _notify(db, farmer_user.id, "Onion crossed ₹2000")

    calls = []
    monkeypatch.setattr("app.services.digest.send_sms", lambda phone, msg: calls.append((phone, msg)) or True)

    sent = send_sms_digests(db)
    assert sent == 1
    assert len(calls) == 1
    assert calls[0][0] == farmer_user.phone
    assert "Onion crossed" in calls[0][1]

    db.refresh(farmer_user)
    assert farmer_user.sms_digest_sent_at is not None


def test_digest_skips_opted_in_user_with_no_unread(db, farmer_user, monkeypatch):
    farmer_user.sms_digest_enabled = True
    db.commit()
    _notify(db, farmer_user.id, "Already seen", read=True)

    calls = []
    monkeypatch.setattr("app.services.digest.send_sms", lambda phone, msg: calls.append(1) or True)

    assert send_sms_digests(db) == 0
    assert calls == []


def test_digest_summarises_multiple_unread(db, farmer_user, monkeypatch):
    farmer_user.sms_digest_enabled = True
    db.commit()
    _notify(db, farmer_user.id, "First alert")
    _notify(db, farmer_user.id, "Second alert")
    _notify(db, farmer_user.id, "Third alert")

    calls = []
    monkeypatch.setattr("app.services.digest.send_sms", lambda phone, msg: calls.append(msg) or True)

    send_sms_digests(db)
    assert "+2 more" in calls[0]


def test_digest_debounced_within_cooldown(db, farmer_user, monkeypatch):
    farmer_user.sms_digest_enabled = True
    farmer_user.sms_digest_sent_at = datetime.now(timezone.utc) - timedelta(hours=5)
    db.commit()
    _notify(db, farmer_user.id, "Onion crossed ₹2000")

    calls = []
    monkeypatch.setattr("app.services.digest.send_sms", lambda phone, msg: calls.append(1) or True)

    assert send_sms_digests(db) == 0
    assert calls == []


def test_digest_resends_after_cooldown_expires(db, farmer_user, monkeypatch):
    farmer_user.sms_digest_enabled = True
    farmer_user.sms_digest_sent_at = datetime.now(timezone.utc) - timedelta(hours=25)
    db.commit()
    _notify(db, farmer_user.id, "Onion crossed ₹2000")

    monkeypatch.setattr("app.services.digest.send_sms", lambda phone, msg: True)
    assert send_sms_digests(db) == 1


def test_digest_skips_inactive_user(db, farmer_user, monkeypatch):
    farmer_user.sms_digest_enabled = True
    farmer_user.is_active = False
    db.commit()
    _notify(db, farmer_user.id, "Onion crossed ₹2000")

    calls = []
    monkeypatch.setattr("app.services.digest.send_sms", lambda phone, msg: calls.append(1) or True)

    assert send_sms_digests(db) == 0
    assert calls == []


def test_digest_not_marked_sent_when_delivery_fails(db, farmer_user, monkeypatch):
    farmer_user.sms_digest_enabled = True
    db.commit()
    _notify(db, farmer_user.id, "Onion crossed ₹2000")

    monkeypatch.setattr("app.services.digest.send_sms", lambda phone, msg: False)
    assert send_sms_digests(db) == 0
    db.refresh(farmer_user)
    assert farmer_user.sms_digest_sent_at is None
