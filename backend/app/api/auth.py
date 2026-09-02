"""Auth router: password registration + login, token refresh, current user.

Phone is the identity, a PBKDF2-hashed password is the credential (no SMS/OTP
in this build). ``/register`` creates the account; ``/login`` verifies the
password. Both return a JWT access + refresh pair.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    CurrentUser,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    LoginBody,
    ProfileUpdate,
    RefreshBody,
    RegisterBody,
    RequestVerification,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def _tokens_for(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(str(user.id), {"role": user.role}),
        refresh_token=create_refresh_token(str(user.id)),
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


# ---------------------------------------------------------------------------
# POST /api/auth/register
# ---------------------------------------------------------------------------

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterBody,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Create an account for a new phone number and sign it in.

    409 if the phone is already registered.
    """
    existing = db.execute(select(User).where(User.phone == body.phone)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this phone number already exists. Please sign in.",
        )

    user = User(
        phone=body.phone,
        name=body.name,
        role=body.role,
        district=body.district or "",
        taluka="",
        state=body.state or "",
        latitude=body.latitude,
        longitude=body.longitude,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("[AgriLink] new account: %s (%s)", body.phone, body.role)
    return _tokens_for(user)


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------

@router.post("/login", response_model=AuthResponse)
def login(
    body: LoginBody,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Verify phone + password and issue an access + refresh token pair."""
    _401 = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Wrong phone number or password",
    )

    user = db.execute(select(User).where(User.phone == body.phone)).scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise _401
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account inactive")

    return _tokens_for(user)


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


# ---------------------------------------------------------------------------
# PATCH /api/auth/me  — the user sets their own trading location / details
# ---------------------------------------------------------------------------

@router.patch("/me", response_model=UserResponse)
def update_me(
    body: ProfileUpdate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> UserResponse:
    data = body.model_dump(exclude_unset=True)
    if body.latitude is not None or body.longitude is not None:
        if body.latitude is None or body.longitude is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                                "latitude and longitude must be provided together")
    for field, value in data.items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)


# ---------------------------------------------------------------------------
# POST /api/auth/me/request-verification  — user asks an admin to verify them
# ---------------------------------------------------------------------------

@router.post("/me/request-verification", response_model=UserResponse)
def request_verification(
    body: RequestVerification,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> UserResponse:
    if current_user.verification_status == "verified":
        raise HTTPException(status.HTTP_409_CONFLICT, "This account is already verified.")
    current_user.verification_status = "pending"
    if body.note is not None:
        current_user.verification_note = body.note
    if body.reference is not None:
        current_user.verification_ref = body.reference
    db.commit()
    db.refresh(current_user)
    logger.info("[AgriLink] verification requested by user %d", current_user.id)
    return UserResponse.model_validate(current_user)
