"""JWT helpers, password hashing, and FastAPI auth dependencies.

Design decisions (from 2-CONTEXT.md):
- D-03: HS256 JWT, short-lived access token (30 min) + long-lived refresh token (7 days).
- D-07: Bearer token via HTTPBearer; get_current_user fetches the User row and raises 401.
- Passwords are hashed with PBKDF2-HMAC-SHA256 (stdlib only — no bcrypt/passlib
  dependency, keeps the build offline-installable) and compared in constant time.
"""

import base64
import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)
_bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Signing secret
# ---------------------------------------------------------------------------
# JWT_SECRET_KEY must be set in any real deployment. If it is blank we must NOT
# fall back to a well-known constant — that would let anyone forge tokens
# (including admin tokens). Instead we mint a random per-process secret: tokens
# still work within a single run, but they don't validate against a guessable
# value and don't survive a restart (which is the correct, loud failure mode
# for a misconfigured deployment).
_EPHEMERAL_SECRET = secrets.token_hex(32)


def _signing_secret() -> str:
    if settings.jwt_secret_key:
        return settings.jwt_secret_key
    logger.warning(
        "JWT_SECRET_KEY is not set — using a random per-process secret. "
        "Tokens will not survive a restart. Set JWT_SECRET_KEY for production."
    )
    return _EPHEMERAL_SECRET


# ---------------------------------------------------------------------------
# Password hashing — PBKDF2-HMAC-SHA256, Django-style "algo$iters$salt$hash"
# ---------------------------------------------------------------------------

_PBKDF2_ITERS = 600_000


def hash_password(raw: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", raw.encode("utf-8"), salt, _PBKDF2_ITERS)
    return "pbkdf2_sha256${}${}${}".format(
        _PBKDF2_ITERS,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(dk).decode("ascii"),
    )


def verify_password(raw: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        algo, iters_s, salt_b64, hash_b64 = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        dk = hashlib.pbkdf2_hmac("sha256", raw.encode("utf-8"), salt, int(iters_s))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(dk, expected)


# ---------------------------------------------------------------------------
# Token creation
# ---------------------------------------------------------------------------

def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def create_access_token(subject: str, extra: dict | None = None) -> str:
    """Create a short-lived HS256 access JWT.

    ``subject`` is the user's id as a string.
    ``extra`` may carry additional claims (e.g. ``{"role": "farmer"}``).
    """
    from datetime import timedelta  # local import avoids circular at module load

    payload: dict = {
        "sub": subject,
        "type": "access",
        "iat": _utcnow(),
        "exp": _utcnow() + timedelta(minutes=settings.access_token_expire_minutes),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, _signing_secret(), algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str) -> str:
    """Create a long-lived HS256 refresh JWT.

    Contains ``"type": "refresh"`` so it cannot be used as an access token.
    """
    from datetime import timedelta

    payload: dict = {
        "sub": subject,
        "type": "refresh",
        "iat": _utcnow(),
        "exp": _utcnow() + timedelta(days=settings.refresh_token_expire_days),
    }
    return jwt.encode(payload, _signing_secret(), algorithm=settings.jwt_algorithm)


# ---------------------------------------------------------------------------
# Token decoding
# ---------------------------------------------------------------------------

def decode_token(token: str) -> dict:
    """Decode and validate a JWT.  Raises ``jose.JWTError`` on any failure."""
    return jwt.decode(
        token,
        _signing_secret(),
        algorithms=[settings.jwt_algorithm],
    )


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Dependency: decode the Bearer JWT and return the matching User.

    Raises HTTP 401 on missing token, invalid/expired JWT, or unknown user.
    Raises HTTP 403 if the user account is inactive.
    """
    _401 = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise _401

    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise _401

    if payload.get("type") != "access":
        raise _401

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise _401

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise _401

    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None:
        raise _401
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account inactive")

    return user


# Annotated alias for use in route signatures
CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: str):
    """Dependency factory: raises HTTP 403 if current user's role is not in ``roles``."""

    def _check(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not permitted for this action",
            )
        return current_user

    return Depends(_check)
