"""Tests for the auth layer.

Covers:
- Register: creates the account + hashes the password; 409 on a duplicate phone
- Login: phone + password → tokens; wrong password / unknown phone → 401
- Password hashing round-trip
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
    hash_password,
    require_role,
    verify_password,
)
from app.main import app
from app.models.user import User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _register(
    client: TestClient,
    phone: str = "+910000000099",
    name: str = "Test",
    role: str = "farmer",
    password: str = "hunter2!",
) -> dict:
    resp = client.post(
        "/api/auth/register",
        json={"phone": phone, "name": name, "role": role, "password": password},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def test_password_hash_round_trip():
    h = hash_password("correct horse battery staple")
    assert h.startswith("pbkdf2_sha256$")
    assert h != hash_password("correct horse battery staple")  # random salt
    assert verify_password("correct horse battery staple", h)
    assert not verify_password("wrong", h)
    assert not verify_password("anything", None)


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

def test_register_creates_user_and_returns_tokens(auth_client, db):
    phone = "+910000000010"
    data = _register(auth_client, phone=phone, name="New User", role="farmer")

    assert "access_token" in data and "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["phone"] == phone
    assert data["user"]["role"] == "farmer"

    user = db.execute(select(User).where(User.phone == phone)).scalar_one_or_none()
    assert user is not None
    assert user.password_hash and user.password_hash.startswith("pbkdf2_sha256$")


def test_register_duplicate_phone_conflicts(auth_client, db):
    _register(auth_client, phone="+910000000011")
    resp = auth_client.post(
        "/api/auth/register",
        json={"phone": "+910000000011", "name": "Again", "role": "buyer", "password": "another1"},
    )
    assert resp.status_code == 409


def test_register_rejects_short_password(auth_client, db):
    resp = auth_client.post(
        "/api/auth/register",
        json={"phone": "+910000000012", "name": "Shorty", "role": "farmer", "password": "abc"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

def test_login_with_correct_password(auth_client, db):
    _register(auth_client, phone="+910000000020", role="buyer", password="s3cret!!")
    resp = auth_client.post(
        "/api/auth/login", json={"phone": "+910000000020", "password": "s3cret!!"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["role"] == "buyer"
    assert decode_token(data["access_token"])["role"] == "buyer"


def test_login_wrong_password(auth_client, db):
    _register(auth_client, phone="+910000000021", password="rightpass")
    resp = auth_client.post(
        "/api/auth/login", json={"phone": "+910000000021", "password": "wrongpass"}
    )
    assert resp.status_code == 401


def test_login_unknown_phone(auth_client, db):
    resp = auth_client.post(
        "/api/auth/login", json={"phone": "+919999999999", "password": "whatever"}
    )
    assert resp.status_code == 401


def test_login_inactive_account(auth_client, db):
    _register(auth_client, phone="+910000000022", password="rightpass")
    user = db.execute(select(User).where(User.phone == "+910000000022")).scalar_one()
    user.is_active = False
    db.commit()
    resp = auth_client.post(
        "/api/auth/login", json={"phone": "+910000000022", "password": "rightpass"}
    )
    assert resp.status_code == 403


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
