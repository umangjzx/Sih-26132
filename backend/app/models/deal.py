from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Deal(Base):
    """logistics_mode: self_pickup | platform_arranged (stub).
    payment_status: pending | paid.
    pipeline_status: matched | offer_accepted | logistics_arranged | delivered | paid | closed.
    """

    __tablename__ = "deals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"))
    agreed_price: Mapped[float] = mapped_column(Float)
    agreed_quantity: Mapped[float] = mapped_column(Float)
    logistics_mode: Mapped[str] = mapped_column(String(30), default="self_pickup")
    payment_status: Mapped[str] = mapped_column(String(20), default="pending")
    pipeline_status: Mapped[str] = mapped_column(String(30), default="matched")
    # v1.4: recorded by the buyer when they mark the deal paid.
    payment_method: Mapped[str | None] = mapped_column(String(40), nullable=True)
    payment_reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
