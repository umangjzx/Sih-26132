"""Auth router: OTP request/verify, token refresh, and current-user endpoint.

Design (from 2-CONTEXT.md):
- D-02: OTP flow — otp/request upserts User, logs OTP; otp/verify validates, issues JWT pair.
- D-04: OTP stored on users.otp_code + otp_expires_at; TTL from settings.otp_ttl_seconds.
- D-05: OTP compared with secrets.compare_digest (constant-time).
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    CurrentUser,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_otp,
)
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    OtpRequestBody,
    OtpVerifyBody,
    RefreshBody,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


# ---------------------------------------------------------------------------
# POST /api/auth/otp/request
# ---------------------------------------------------------------------------

@router.post("/otp/request")
def request_otp(
    body: OtpRequestBody,
    db: Session = Depends(get_db),
) -> dict:
    """Upsert the user, generate a 6-digit OTP, and log it to the console.

    No SMS gateway is called — the OTP appears in the server log for demo purposes.
    """
    user = db.execute(select(User).where(User.phone == body.phone)).scalar_one_or_none()

    if user is None:
        user = User(
            phone=body.phone,
            name=body.name,
            role=body.role,
            district="",
            taluka="",
        )
        db.add(user)
        db.flush()  # get the id before commit

    otp = generate_otp()
    user.otp_code = otp
    user.otp_expires_at = _utcnow() + timedelta(seconds=settings.otp_ttl_seconds)
    db.commit()

    # D-02: OTP delivery is stubbed — logged to console for demo.
    logger.info(
        "[AgriLink OTP] Phone %s → Code: %s (expires %d min)",
        body.phone,
        otp,
        settings.otp_ttl_seconds // 60,
    )

    resp: dict = {"detail": "OTP sent"}
    if settings.expose_otp:
        # No SMS gateway in this build — hand the code back so the demo can log in.
        resp["dev_otp"] = otp
    return resp


# ---------------------------------------------------------------------------
# POST /api/auth/otp/verify
# ---------------------------------------------------------------------------

@router.post("/otp/verify", response_model=AuthResponse)
def verify_otp(
    body: OtpVerifyBody,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Verify the OTP and issue an access + refresh token pair."""
    _401 = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired OTP",
    )

    user = db.execute(select(User).where(User.phone == body.phone)).scalar_one_or_none()
    if user is None:
        raise _401

    # All three conditions must hold: code present, constant-time match, not expired.
    if user.otp_code is None or user.otp_expires_at is None:
        raise _401

    if not secrets.compare_digest(body.code, user.otp_code):
        raise _401

    # Compare expiry in a timezone-safe way: SQLite returns naive datetimes,
    # PostgreSQL returns aware ones. Normalise both to UTC for the comparison.
    expires = user.otp_expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if _utcnow() > expires:
        raise _401

    # Clear the OTP so it cannot be reused.
    user.otp_expires_at = None
    db.commit()
    db.refresh(user)

    return AuthResponse(
        access_token=create_access_token(str(user.id), {"role": user.role}),
        refresh_token=create_refresh_token(str(user.id)),
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


# ---------------------------------------------------------------------------
# POST /api/auth/refresh
# ---------------------------------------------------------------------------

@router.post("/refresh", response_model=TokenResponse)
def refresh_tokens(
    body: RefreshBody,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Exchange a valid refresh token for a new access + refresh token pair."""
    _401 = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
    )

    from jose import JWTError

    try:
        payload = decode_token(body.refresh_token)
    except JWTError:
        raise _401

    if payload.get("type") != "refresh":
        raise _401

    user_id_str = payload.get("sub")
    try:
        user_id = int(user_id_str)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        raise _401

    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None or not user.is_active:
        raise _401

    return TokenResponse(
        access_token=create_access_token(str(user.id), {"role": user.role}),
        refresh_token=create_refresh_token(str(user.id)),
    )


# ---------------------------------------------------------------------------
# GET /api/auth/me
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserResponse)
def get_me(current_user: CurrentUser) -> UserResponse:
    """Return the currently authenticated user's profile."""
    return UserResponse.model_validate(current_user)
