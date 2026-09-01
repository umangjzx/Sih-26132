"""JWT helpers, OTP generation, and FastAPI auth dependencies.

Design decisions (from 2-CONTEXT.md):
- D-03: HS256 JWT, short-lived access token (30 min) + long-lived refresh token (7 days).
- D-05: No password hashing — OTP is the only credential; compared with secrets.compare_digest.
- D-07: Bearer token via HTTPBearer; get_current_user fetches the User row and raises 401.
- D-11: This module owns generate_otp, create_access_token, create_refresh_token, decode_token.
"""

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

_bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# OTP
# ---------------------------------------------------------------------------

def generate_otp() -> str:
    """Return a zero-padded 6-digit OTP string using a cryptographically secure source."""
    return str(secrets.randbelow(1_000_000)).zfill(6)


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
    return jwt.encode(payload, settings.jwt_secret_key or "dev-secret", algorithm=settings.jwt_algorithm)


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
    return jwt.encode(payload, settings.jwt_secret_key or "dev-secret", algorithm=settings.jwt_algorithm)


# ---------------------------------------------------------------------------
# Token decoding
# ---------------------------------------------------------------------------

def decode_token(token: str) -> dict:
    """Decode and validate a JWT.  Raises ``jose.JWTError`` on any failure."""
    return jwt.decode(
        token,
        settings.jwt_secret_key or "dev-secret",
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
