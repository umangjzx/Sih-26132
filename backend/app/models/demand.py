from sqlalchemy import Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Demand(Base):
    """status: open | matched | closed."""

    __tablename__ = "demands"
    __table_args__ = (
        # Supports discovery.py's bounding-box pre-filter on browse_demands'
        # radius search (a lat/lon BETWEEN range on both columns).
        Index("ix_demands_lat_lon", "latitude", "longitude"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    crop: Mapped[str] = mapped_column(String(120))
    quantity_kg: Mapped[float] = mapped_column(Float)
    quality_spec: Mapped[str] = mapped_column(String(500))
    # v1.4: canonical minimum grade the buyer will accept (A | B | FAQ | C).
    # Falls back to parsing quality_spec when unset.
    quality_grade_min: Mapped[str | None] = mapped_column(String(10), nullable=True)
    price_band_min: Mapped[float] = mapped_column(Float)
    price_band_max: Mapped[float] = mapped_column(Float)
    delivery_window: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)

    # v1.4: where the buyer wants delivery (defaults to the buyer's own
    # location on create). Used for distance-aware matching + the radius veto.
    delivery_district: Mapped[str] = mapped_column(String(120), default="", server_default="")
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
