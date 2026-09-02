"""Forward contracts (v1.6) — pre-harvest market linkage.

A buyer posts a ``ForwardBid``: how much of a crop they will buy, in what
price band, for delivery inside a future window. A farmer who is sowing /
growing that crop posts a ``ForwardCommitment`` against it — locking a price
before harvest. When the buyer accepts a commitment it materialises into the
normal deal pipeline (Lot + Match + Offer + Deal at ``matched``), so
logistics, payment and disputes all work unchanged.
"""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ForwardBid(Base):
    """status: open | closed | filled | cancelled."""

    __tablename__ = "forward_bids"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    crop: Mapped[str] = mapped_column(String(120), index=True)
    quantity_kg: Mapped[float] = mapped_column(Float)          # total sought
    price_min: Mapped[float] = mapped_column(Float)            # ₹/quintal band
    price_max: Mapped[float] = mapped_column(Float)
    delivery_from: Mapped[date] = mapped_column(Date)
    delivery_to: Mapped[date] = mapped_column(Date)
    delivery_district: Mapped[str] = mapped_column(String(120), default="", server_default="")
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    quality_grade_min: Mapped[str | None] = mapped_column(String(10), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open", server_default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ForwardCommitment(Base):
    """status: pending | accepted | declined | withdrawn."""

    __tablename__ = "forward_commitments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bid_id: Mapped[int] = mapped_column(ForeignKey("forward_bids.id"), index=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    quantity_kg: Mapped[float] = mapped_column(Float)
    price_per_qtl: Mapped[float] = mapped_column(Float)
    expected_ready: Mapped[date] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="pending", server_default="pending", index=True
    )
    deal_id: Mapped[int | None] = mapped_column(ForeignKey("deals.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
