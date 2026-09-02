from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class User(Base):
    """role: farmer | buyer | admin.

    kyc_status mirrors ``verification_status`` and is kept for the existing
    "verified" badges; ``verification_status`` is the one an admin drives
    (unverified -> pending -> verified | rejected).
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    district: Mapped[str] = mapped_column(String(120))
    taluka: Mapped[str] = mapped_column(String(120))
    kyc_status: Mapped[str] = mapped_column(String(20), default="unverified")

    # v1.4: where this user actually trades from. Without it every "nearby"
    # feature falls back to a neutral score, so distance-aware matching and the
    # radius filters only work once this is set.
    state: Mapped[str] = mapped_column(String(120), default="", server_default="")
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # v1.4: real verification workflow (admin-driven).
    verification_status: Mapped[str] = mapped_column(
        String(20), default="unverified", server_default="unverified"
    )
    verification_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    verification_ref: Mapped[str | None] = mapped_column(String(120), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Phase 2: auth columns. otp_* are dormant (OTP flow removed); password_hash
    # holds a PBKDF2-HMAC-SHA256 digest (see app/core/security.py).
    otp_code: Mapped[str | None] = mapped_column(String(6), nullable=True)
    otp_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
