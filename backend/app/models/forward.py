"""Forward contracts (v1.6) — pre-harvest market linkage.

A buyer posts a ``ForwardBid``: how much of a crop they will buy, in what
price band, for delivery inside a future window. A farmer who is sowing /
growing that crop posts a ``ForwardCommitment`` against it — locking a price
before harvest. When the buyer accepts a commitment it materialises into the
normal deal pipeline (Lot + Match + Offer + Deal at ``matched``), so
logistics, payment and disputes all work unchanged.
"""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Integer, String, func, text
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
    """status: pending | accepted | declined | withdrawn | breached."""

    __tablename__ = "forward_commitments"
    __table_args__ = (
        # A farmer may only have one *active* (pending/accepted) commitment on
        # a given bid at a time — commit_to_bid enforces this in Python, but a
        # double-submit (multi-tab, retried request) could race past that
        # check and insert two. This backs the invariant at the DB level so
        # the race becomes an IntegrityError (caught and turned into the same
        # 409) instead of a silently duplicated commitment. Past withdrawn/
        # declined rows are intentionally excluded so a farmer can re-commit
        # after withdrawing.
        Index(
            "uq_forward_commitment_active_per_farmer_bid",
            "bid_id", "farmer_id",
            unique=True,
            postgresql_where=text("status IN ('pending', 'accepted')"),
            sqlite_where=text("status IN ('pending', 'accepted')"),
        ),
    )

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
    # v1.8: set once, at accept time, to the later of the farmer's own expected-ready
    # date and the buyer's delivery window close — the date by which this forward
    # commitment's deal should have moved past 'matched'/'offer_accepted'. Used to
    # flag an accepted commitment as overdue when nothing enforces on-time delivery.
    settlement_due: Mapped[date | None] = mapped_column(Date, nullable=True)
    settlement_reminder_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # v1.11: settlement enforcement. Set only when an admin resolves a dispute
    # on this commitment's deal with `apply_forward_penalty=true` (see
    # app/api/disputes.py). breach_status: farmer_breach | buyer_breach —
    # whichever party the dispute outcome found at fault. penalty_inr is a
    # computed, informational figure (settings.forward_penalty_pct of contract
    # value); the platform holds no money or crop and never collects it.
    breach_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    penalty_inr: Mapped[float | None] = mapped_column(Float, nullable=True)
    breached_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
