"""Per-deal payment record (Phase 2 roadmap).

Separate from the Deal.payment_status flag: a Deal can have multiple partial
payments (e.g. 20% advance, 80% on delivery) that sum to the agreed value.
Each row captures the payer, amount, method, reference, and timestamp so we
have an auditable trail and can compute settled vs outstanding amounts.
"""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DealPayment(Base):
    """Represents one payment instalment against a deal.

    A deal is fully settled when SUM(amount_inr) >= agreed_price/qtl × qty/100.
    Partial payments are allowed; the Deal.payment_status mirrors settled status
    and is synced by the endpoint after every upsert.
    """

    __tablename__ = "deal_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("deals.id"), index=True)

    # Who paid? (buyer → farmer; stored so admin can audit both directions)
    payer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    amount_inr: Mapped[float] = mapped_column(Float)  # actual ₹ amount paid
    # UPI | NEFT | RTGS | IMPS | Cheque | Cash | Other
    method: Mapped[str] = mapped_column(String(30), default="UPI")
    reference: Mapped[str | None] = mapped_column(String(160), nullable=True)
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)

    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
