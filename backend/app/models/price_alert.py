from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PriceAlert(Base):
    """A user's standing request to be notified when a crop's modal price at a
    market crosses a threshold. Evaluated after every ingestion cycle.

    direction: 'above' | 'below'
    """

    __tablename__ = "price_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    crop: Mapped[str] = mapped_column(String(120))
    market: Mapped[str] = mapped_column(String(120))
    direction: Mapped[str] = mapped_column(String(10), default="above")
    threshold: Mapped[float] = mapped_column(Float)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        # create_alert rejects an exact case-insensitive duplicate in Python
        # (same user/crop/market/direction/threshold) — a double-submit could
        # race past that check and insert two, which would just double-fire
        # the same notification, but is still worth closing at the DB level.
        # A functional index on lower(crop)/lower(market) matches the
        # case-insensitive semantics of that check exactly.
        Index(
            "uq_price_alert_dedup",
            "user_id", func.lower(crop), func.lower(market), "direction", "threshold",
            unique=True,
        ),
    )
