from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Offer(Base):
    """status: pending | countered | accepted | declined."""

    __tablename__ = "offers"
    __table_args__ = (
        # post_offer always supersedes every existing pending offer on a
        # match (sets it to "countered") before inserting a new one — so at
        # most one pending offer should ever exist per match. A double-submit,
        # or two parties posting at the same instant, could race past that
        # in-Python supersede-then-insert and leave two. This backs the
        # invariant at the DB level.
        Index(
            "uq_offer_pending_per_match",
            "match_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
            sqlite_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"))
    from_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    price: Mapped[float] = mapped_column(Float)
    quantity: Mapped[float] = mapped_column(Float)
    message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
