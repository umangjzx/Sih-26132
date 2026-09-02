"""Group / pooled requests (v1.3) — FPO collective bargaining.

Small farmers commit part of a harvest to a shared Pool for one crop. The pool
then negotiates with big buyers as a single unit: its quantity is the sum of the
committed members and its asking price is their quantity-weighted average,
floored at ``floor_price`` so nobody is sold below what they agreed to.
"""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Pool(Base):
    """status: open | locked | matched | closed.

    open   — accepting members
    locked — organizer stopped intake, negotiating with buyers
    matched— a buyer demand was accepted for the pool
    closed — done / cancelled
    """

    __tablename__ = "pools"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organizer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    crop: Mapped[str] = mapped_column(String(120), index=True)
    title: Mapped[str] = mapped_column(String(200))
    target_quantity_kg: Mapped[float] = mapped_column(Float)
    floor_price: Mapped[float] = mapped_column(Float)  # ₹/quintal the pool won't go below
    grade: Mapped[str] = mapped_column(String(50), default="B")
    delivery_window: Mapped[str] = mapped_column(String(120), default="")
    location: Mapped[str] = mapped_column(String(120), default="")
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PoolMember(Base):
    """status: committed | withdrawn. One row per farmer per pool."""

    __tablename__ = "pool_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pool_id: Mapped[int] = mapped_column(ForeignKey("pools.id"), index=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    lot_id: Mapped[int | None] = mapped_column(ForeignKey("lots.id"), nullable=True)
    quantity_kg: Mapped[float] = mapped_column(Float)
    expected_price: Mapped[float] = mapped_column(Float)  # ₹/quintal
    status: Mapped[str] = mapped_column(String(20), default="committed")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
