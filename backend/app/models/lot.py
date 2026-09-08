from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Lot(Base):
    """status: open | matched | closed."""

    __tablename__ = "lots"
    __table_args__ = (
        # Supports discovery.py's bounding-box pre-filter on browse_lots'
        # radius search (a lat/lon BETWEEN range on both columns).
        Index("ix_lots_lat_lon", "latitude", "longitude"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    crop: Mapped[str] = mapped_column(String(120))
    quantity_kg: Mapped[float] = mapped_column(Float)
    quality_grade: Mapped[str] = mapped_column(String(50))
    # A short http(s) URL, or a `data:image/...;base64,...` photo (v1.9) — Text
    # because a base64-encoded photo is far larger than any URL.
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # v1.37 — a genuinely small (~96px) thumbnail generated client-side
    # alongside photo_url. Match/deal list responses (LotSummary) expose
    # only this, never the full photo_url, since every place that shows a
    # counterparty's lot photo (buyer dashboard, match thread) only ever
    # renders it at 40-64px anyway — embedding the full compressed photo in
    # every row of those list endpoints was pure payload bloat.
    photo_thumb_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_price: Mapped[float] = mapped_column(Float)
    available_from: Mapped[date] = mapped_column(Date)
    location: Mapped[str] = mapped_column(String(120))
    # Geocoded from `location` on create (best-effort; nullable when geocoding fails).
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    # set when this lot is the aggregate of an FPO Pool (organizer-created).
    # Plain int, not a FK — avoids a pools↔deals↔matches↔lots cycle.
    pool_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
