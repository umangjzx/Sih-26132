"""Tests for the auth layer.

Covers:
- Login: creates user on first call, reissues tokens for an existing user
- Token refresh: valid refresh → new pair; bad token → 401
- GET /me: valid token → user; no token → 401
- require_role gating: wrong role → 403
"""

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

def _login(client: TestClient, phone: str = "+910000000099", name: str = "Test", role: str = "farmer") -> dict:
    resp = client.post("/api/auth/login", json={"phone": phone, "name": name, "role": role})
    assert resp.status_code == 200, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Login (passwordless, OTP-less)
# ---------------------------------------------------------------------------

def test_login_creates_user_and_returns_tokens(auth_client, db):
    phone = "+910000000010"
    data = _login(auth_client, phone=phone, name="New User", role="farmer")

    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["phone"] == phone
    assert data["user"]["role"] == "farmer"
    assert data["user"]["name"] == "New User"

    user = db.execute(select(User).where(User.phone == phone)).scalar_one_or_none()
    assert user is not None and user.role == "farmer"


def test_login_is_idempotent_for_existing_user(auth_client, db):
    phone = "+910000000011"
    _login(auth_client, phone=phone, name="First", role="farmer")
    # A second login with a different name/role must not create a new row
    # and must not overwrite the stored profile.
    _login(auth_client, phone=phone, name="Different", role="buyer")

    users = db.execute(select(User).where(User.phone == phone)).scalars().all()
    assert len(users) == 1
    assert users[0].name == "First"
    assert users[0].role == "farmer"


def test_login_access_token_carries_role(auth_client, db):
    data = _login(auth_client, phone="+910000000020", role="buyer")
    payload = decode_token(data["access_token"])
    assert payload["role"] == "buyer"


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
