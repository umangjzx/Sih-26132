"""Append-only audit log for every significant platform action.

Written on: offer created/accepted/declined, deal advanced, dispute raised/closed,
payment recorded, lot/demand created/closed. Never updated or deleted — it is a
ledger, not a mutable table.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TransactionEvent(Base):
    __tablename__ = "transaction_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # actor_id is None for system-generated events (scheduler, seeding)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    # entity_type: deal | offer | dispute | payment | lot | demand | pool
    entity_type: Mapped[str] = mapped_column(String(30))
    entity_id: Mapped[int] = mapped_column(Integer)

    # human-readable camel_case action: advance_to_paid, offer_accepted, ...
    action: Mapped[str] = mapped_column(String(60))

    # JSON-encoded dict of relevant extra values (price, stage, reference, …)
    detail: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
