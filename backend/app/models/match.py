from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Match(Base):
    """status: proposed | offered | accepted | rejected."""

    __tablename__ = "matches"
    __table_args__ = (
        # _score_and_upsert / try_pair both check-then-insert keyed on
        # (lot_id, demand_id), with an intentional invariant that a Match in
        # any terminal-ish status (accepted/rejected) is never superseded by
        # a new row for the same pair — only a proposed/offered one is
        # updated in place. A double-submit (multi-tab "express interest"
        # click, or a manual rematch racing an express-interest call) could
        # insert two. This backs the invariant at the DB level.
        UniqueConstraint("lot_id", "demand_id", name="uq_match_lot_demand"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lot_id: Mapped[int] = mapped_column(ForeignKey("lots.id"))
    demand_id: Mapped[int] = mapped_column(ForeignKey("demands.id"))
    score: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="proposed")
    # JSON string storing per-component score breakdown for explainability (Phase 2).
    score_detail: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    # v1.22 — lets the frontend flag a match that's sat unanswered for a
    # while as "at risk" instead of just listing it identically to a
    # same-day one; also generally useful for sorting/auditing.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
