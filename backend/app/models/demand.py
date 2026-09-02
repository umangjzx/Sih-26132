from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Demand(Base):
    """status: open | matched | closed."""

    __tablename__ = "demands"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    crop: Mapped[str] = mapped_column(String(120))
    quantity_kg: Mapped[float] = mapped_column(Float)
    quality_spec: Mapped[str] = mapped_column(String(500))
    price_band_min: Mapped[float] = mapped_column(Float)
    price_band_max: Mapped[float] = mapped_column(Float)
    delivery_window: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="open")

    # v1.4: where the buyer wants delivery (defaults to the buyer's own
    # location on create). Used for distance-aware matching + the radius veto.
    delivery_district: Mapped[str] = mapped_column(String(120), default="", server_default="")
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
