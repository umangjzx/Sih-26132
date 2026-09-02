"""Auth router: passwordless login, token refresh, and current-user endpoint.

The demo build has no SMS gateway and no password store, so login is a single
step: the caller identifies by phone (with a name + role for first-time
sign-up) and immediately receives a JWT pair. OTP / password flows were
removed for the hackathon build — see git history to restore them.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    CurrentUser,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    LoginBody,
    RefreshBody,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


# ---------------------------------------------------------------------------
# POST /api/auth/login  — passwordless, OTP-less
# ---------------------------------------------------------------------------

@router.post("/login", response_model=AuthResponse)
def login(
    body: LoginBody,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Identify by phone and issue an access + refresh token pair.

    The account is created on first login (name + role from the request);
    on later logins the stored name/role are kept and only the tokens reissue.
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
        db.commit()
        db.refresh(user)
        logger.info("[AgriLink] new account: %s (%s)", body.phone, body.role)

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
