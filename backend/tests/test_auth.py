"""Tests for the Phase 2 auth layer.

Covers:
- OTP request: creates user on first call, upserts OTP on repeat calls
- OTP verify: correct code → tokens; wrong/expired code → 401
- Token refresh: valid refresh → new pair; bad token → 401
- GET /me: valid token → user; no token → 401
- require_role gating: wrong role → 403
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    require_role,
)
from app.main import app
from app.models.user import User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _request_otp(client: TestClient, phone: str = "+910000000099", name: str = "Test", role: str = "farmer") -> None:
    resp = client.post("/api/auth/otp/request", json={"phone": phone, "name": name, "role": role})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["detail"] == "OTP sent"
    # demo build hands the code back (settings.expose_otp defaults to True)
    assert "dev_otp" in body and len(body["dev_otp"]) == 6


def _get_otp_code(db, phone: str) -> str:
    user = db.execute(select(User).where(User.phone == phone)).scalar_one()
    assert user.otp_code is not None
    return user.otp_code


def _verify_otp(client: TestClient, phone: str, code: str) -> dict:
    resp = client.post("/api/auth/otp/verify", json={"phone": phone, "code": code})
    assert resp.status_code == 200, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# OTP request
# ---------------------------------------------------------------------------

def test_otp_request_creates_user(auth_client, db):
    phone = "+910000000010"
    _request_otp(auth_client, phone=phone, name="New User", role="farmer")
    user = db.execute(select(User).where(User.phone == phone)).scalar_one_or_none()
    assert user is not None
    assert user.role == "farmer"
    assert user.name == "New User"
    assert user.otp_code is not None
    assert len(user.otp_code) == 6


def test_otp_request_hides_code_when_expose_disabled(auth_client, db, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "expose_otp", False)
    resp = auth_client.post(
        "/api/auth/otp/request",
        json={"phone": "+910000000011", "name": "Prod", "role": "buyer"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"detail": "OTP sent"}


def test_otp_request_upserts_existing_user(auth_client, db):
    phone = "+910000000011"
    _request_otp(auth_client, phone=phone)
    first_otp = _get_otp_code(db, phone)

    _request_otp(auth_client, phone=phone)
    second_otp = _get_otp_code(db, phone)

    # Still exactly one row, OTP is refreshed
    users = db.execute(select(User).where(User.phone == phone)).scalars().all()
    assert len(users) == 1
    # OTP may or may not have changed (random), but it is present and 6 digits
    assert len(second_otp) == 6
    # otp_expires_at must be set and in the future
    # (SQLite returns naive datetimes; normalise for the comparison)
    user = users[0]
    expires = user.otp_expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    assert expires > datetime.now(tz=timezone.utc)


# ---------------------------------------------------------------------------
# OTP verify
# ---------------------------------------------------------------------------

def test_otp_verify_returns_tokens(auth_client, db):
    phone = "+910000000020"
    _request_otp(auth_client, phone=phone, role="buyer")
    code = _get_otp_code(db, phone)

    data = _verify_otp(auth_client, phone, code)
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["phone"] == phone
    assert data["user"]["role"] == "buyer"


def test_otp_verify_clears_otp_after_success(auth_client, db):
    """Verify that the same OTP code cannot be used a second time (cleared on first use)."""
    phone = "+910000000021"
    _request_otp(auth_client, phone=phone)
    code = _get_otp_code(db, phone)

    # First use succeeds
    _verify_otp(auth_client, phone, code)

    # Second use with the same code must fail (OTP cleared server-side)
    resp = auth_client.post("/api/auth/otp/verify", json={"phone": phone, "code": code})
    assert resp.status_code == 401


def test_otp_verify_wrong_code(auth_client, db):
    phone = "+910000000022"
    _request_otp(auth_client, phone=phone)
    resp = auth_client.post("/api/auth/otp/verify", json={"phone": phone, "code": "000000"})
    # The real OTP is almost certainly not "000000"; 1-in-a-million chance of false failure
    # but acceptable for a test suite.
    assert resp.status_code == 401


def test_otp_verify_expired(auth_client, db):
    phone = "+910000000023"
    _request_otp(auth_client, phone=phone)
    # Force expiry by backdating otp_expires_at
    user = db.execute(select(User).where(User.phone == phone)).scalar_one()
    user.otp_expires_at = datetime.now(tz=timezone.utc) - timedelta(seconds=1)
    db.commit()

    code = user.otp_code
    resp = auth_client.post("/api/auth/otp/verify", json={"phone": phone, "code": code})
    assert resp.status_code == 401


def test_otp_verify_unknown_phone(auth_client, db):
    resp = auth_client.post("/api/auth/otp/verify", json={"phone": "+919999999999", "code": "123456"})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

def test_refresh_returns_new_tokens(auth_client, db, farmer_user):
    refresh_tok = create_refresh_token(str(farmer_user.id))
    resp = auth_client.post("/api/auth/refresh", json={"refresh_token": refresh_tok})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    # New access token must decode to the same subject
    payload = decode_token(data["access_token"])
    assert payload["sub"] == str(farmer_user.id)


def test_refresh_bad_token(auth_client, db):
    resp = auth_client.post("/api/auth/refresh", json={"refresh_token": "garbage.token.here"})
    assert resp.status_code == 401


def test_refresh_access_token_rejected(auth_client, db, farmer_user):
    """An access token must not be accepted as a refresh token."""
    access_tok = create_access_token(str(farmer_user.id))
    resp = auth_client.post("/api/auth/refresh", json={"refresh_token": access_tok})
    assert resp.status_code == 401


def test_refresh_inactive_user(auth_client, db, farmer_user):
    farmer_user.is_active = False
    db.commit()
    refresh_tok = create_refresh_token(str(farmer_user.id))
    resp = auth_client.post("/api/auth/refresh", json={"refresh_token": refresh_tok})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /me
# ---------------------------------------------------------------------------

def test_me_returns_user(auth_client, db, farmer_user):
    token = create_access_token(str(farmer_user.id), {"role": farmer_user.role})
    resp = auth_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == farmer_user.id
    assert data["role"] == "farmer"
    assert data["phone"] == farmer_user.phone


def test_me_no_token(auth_client, db):
    resp = auth_client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_bad_token(auth_client, db):
    resp = auth_client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.token"})
    assert resp.status_code == 401


def test_me_inactive_user(auth_client, db, farmer_user):
    farmer_user.is_active = False
    db.commit()
    token = create_access_token(str(farmer_user.id))
    resp = auth_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# require_role gating
# ---------------------------------------------------------------------------

def test_require_role_rejects_wrong_role(auth_client, db, buyer_user):
    """A buyer token must be rejected by a farmer-only route."""
    # Register a temporary farmer-only route on the app for this test.
    _test_router = APIRouter()

    @_test_router.get("/test-farmer-only")
    def _farmer_only(user: User = require_role("farmer")):
        return {"ok": True}

    app.include_router(_test_router)

    token = create_access_token(str(buyer_user.id), {"role": buyer_user.role})
    resp = auth_client.get("/test-farmer-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403

    # Clean up the temporary route (remove from app.routes)
    app.routes[:] = [r for r in app.routes if getattr(r, "path", None) != "/test-farmer-only"]


def test_require_role_accepts_correct_role(auth_client, db, farmer_user):
    """A farmer token must be accepted by a farmer-only route."""
    _test_router = APIRouter()

    @_test_router.get("/test-farmer-only-2")
    def _farmer_only(user: User = require_role("farmer")):
        return {"ok": True}

    app.include_router(_test_router)

    token = create_access_token(str(farmer_user.id), {"role": farmer_user.role})
    resp = auth_client.get("/test-farmer-only-2", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200

    app.routes[:] = [r for r in app.routes if getattr(r, "path", None) != "/test-farmer-only-2"]
