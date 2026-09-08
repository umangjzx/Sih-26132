from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Dispute(Base):
    """status: open | resolved | withdrawn.

    (The legacy value 'closed' is still accepted from older rows and maps to
    'resolved' semantically.)
    """

    __tablename__ = "disputes"
    __table_args__ = (
        # raise_dispute enforces "only one open dispute per deal" in Python —
        # a double-submit (multi-tab, retried request) could race past that
        # check and open two. This backs the invariant at the DB level.
        # Resolved/withdrawn rows are intentionally excluded so a deal can
        # have a full dispute history across multiple raised-and-resolved
        # rounds.
        Index(
            "uq_dispute_open_per_deal",
            "deal_id",
            unique=True,
            postgresql_where=text("status = 'open'"),
            sqlite_where=text("status = 'open'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("deals.id"), index=True)
    raised_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(String(1000))
    # a photo / document URL the raiser attaches as evidence
    evidence_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open")

    # filled by the admin when the dispute is resolved
    # outcome: favour_farmer | favour_buyer | split | dismissed | no_fault
    outcome: Mapped[str | None] = mapped_column(String(30), nullable=True)
    resolution: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
