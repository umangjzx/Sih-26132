from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FinancingRequest(Base):
    """Warehouse-receipt-backed financing request (v1.17).

    A farmer cites one of their own stored lots as collateral and asks for a
    cash advance against it; an admin reviews and approves/rejects — the same
    self-reported, admin-manual pattern as account verification. The
    platform holds no money and disburses nothing: this tracks the *request*
    and its outcome, not an actual loan (real disbursement needs a licensed
    bank/NBFC partner — see README's Known Limitations).

    status: pending | approved | rejected | withdrawn
    """

    __tablename__ = "financing_requests"
    __table_args__ = (
        # A lot may only have one *active* (pending/approved) financing
        # request at a time — create_request enforces this in Python, but a
        # double-submit (multi-tab, retried request) could race past that
        # check and pledge the same lot twice. This backs the invariant at
        # the DB level. Past rejected/withdrawn rows are intentionally
        # excluded so a farmer can request again after either outcome.
        Index(
            "uq_financing_request_active_per_lot",
            "lot_id",
            unique=True,
            postgresql_where=text("status IN ('pending', 'approved')"),
            sqlite_where=text("status IN ('pending', 'approved')"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    lot_id: Mapped[int] = mapped_column(ForeignKey("lots.id"), index=True)
    requested_amount_inr: Mapped[float] = mapped_column(Float)
    warehouse_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    receipt_ref: Mapped[str | None] = mapped_column(String(120), nullable=True)
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending", index=True)
    admin_note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # v1.20 — stamped once the pledged lot actually sells, so a financed lot's
    # downstream deal is traceable from the financing record instead of only
    # the other way around (deal -> match -> lot).
    deal_id: Mapped[int | None] = mapped_column(ForeignKey("deals.id"), nullable=True, index=True)
