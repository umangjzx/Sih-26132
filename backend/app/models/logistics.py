"""Per-deal logistics plan (v1.4).

One row per deal. Either party can fill it in while the deal is live: how the
produce moves, who's carrying it, when it's picked up, and an indicative cost
derived from the lot↔delivery distance. Status is tracked separately from the
deal pipeline — the pipeline's "delivered" stage is the seller's formal
confirmation, this is the operational plan.
"""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DealLogistics(Base):
    __tablename__ = "deal_logistics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("deals.id"), unique=True, index=True)

    # self_pickup | hired_transport | buyer_arranged
    mode: Mapped[str] = mapped_column(String(30), default="hired_transport")
    transporter_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    transporter_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    vehicle_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    pickup_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    pickup_point: Mapped[str | None] = mapped_column(String(200), nullable=True)
    drop_point: Mapped[str | None] = mapped_column(String(200), nullable=True)

    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    est_cost_inr: Mapped[float | None] = mapped_column(Float, nullable=True)

    # planned | in_transit | delivered
    status: Mapped[str] = mapped_column(String(20), default="planned")
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Proof-of-delivery: a photo URL (or any URL the parties agree on) +
    # the timestamp when one party confirmed receipt/handover.
    pod_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pod_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
