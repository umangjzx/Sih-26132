"""Auth router: password registration + login, token refresh, current user.

Phone is the identity, a PBKDF2-hashed password is the credential (no SMS/OTP
in this build). ``/register`` creates the account; ``/login`` verifies the
password. Both return a JWT access + refresh pair.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import ratelimit
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

# A valid-but-wrong PBKDF2 hash. Verifying against this when the phone is unknown
# keeps /login's response time constant, so it can't be used to enumerate which
# phone numbers have accounts.
_DUMMY_HASH = hash_password("x" * 24)

_LOGIN_LIMIT, _LOGIN_WINDOW_S = 8, 300      # 8 attempts / 5 min per phone
_REGISTER_LIMIT, _REGISTER_WINDOW_S = 10, 3600  # 10 signups / hour per client


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() or (request.client.host if request.client else "unknown")


def _mask_phone(phone: str) -> str:
    return f"***{phone[-4:]}" if len(phone) >= 4 else "***"
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
    request: Request,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Create an account for a new phone number and sign it in.

    409 if the phone is already registered. ``role`` can only be farmer or
    buyer — admin accounts are provisioned out of band.
    """
    if not ratelimit.check(f"register:{_client_ip(request)}",
                           limit=_REGISTER_LIMIT, window_s=_REGISTER_WINDOW_S):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Too many sign-up attempts. Please try again later.")

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
    try:
        db.commit()
    except IntegrityError:  # lost the race on the unique phone constraint
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this phone number already exists. Please sign in.",
        )
    db.refresh(user)
    logger.info("[AgriLink] new account: %s (%s)", _mask_phone(body.phone), body.role)
    return _tokens_for(user)


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------

@router.post("/login", response_model=AuthResponse)
def login(
    body: LoginBody,
    request: Request,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Verify phone + password and issue an access + refresh token pair."""
    _401 = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Wrong phone number or password",
    )

    if not ratelimit.check(f"login:{body.phone}", limit=_LOGIN_LIMIT, window_s=_LOGIN_WINDOW_S):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many sign-in attempts for this number. Please wait a few minutes.",
        )

    user = db.execute(select(User).where(User.phone == body.phone)).scalar_one_or_none()
    # Always run a hash comparison — against the real hash if the account exists,
    # against a dummy otherwise — so an unknown phone can't be told apart from a
    # wrong password by response time.
    ok = verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if user is None or not ok:
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
    # PATCH semantics: only apply the fields the caller actually sent a value
    # for. A blank/whitespace string arrives here as None (see ProfileUpdate)
    # and is ignored rather than nulling a required column.
    for field, value in data.items():
        if value is None:
            continue
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
    # a fresh request supersedes any earlier admin decision
    current_user.verified_at = None
    current_user.verified_by = None
    if body.note is not None:
        current_user.verification_note = body.note
    if body.reference is not None:
        current_user.verification_ref = body.reference
    db.commit()
    db.refresh(current_user)
    logger.info("[AgriLink] verification requested by user %d", current_user.id)
    return UserResponse.model_validate(current_user)
