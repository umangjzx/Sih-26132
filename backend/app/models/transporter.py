"""Curated transporter directory (Phase 2 roadmap).

Seeded once at startup (idempotent). Farmers and buyers can look up nearby
transporters by district/state when arranging logistics for a deal.
"""

from sqlalchemy import Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Transporter(Base):
    __tablename__ = "transporters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)

    # e.g. "Tractor-trolley, Tempo 407, Mini-truck"
    vehicle_types: Mapped[str | None] = mapped_column(String(200), nullable=True)
    rate_per_km_per_qtl: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_capacity_tonnes: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
