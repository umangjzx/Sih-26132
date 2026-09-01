from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Lot(Base):
    """status: open | matched | closed."""

    __tablename__ = "lots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    crop: Mapped[str] = mapped_column(String(120))
    quantity_kg: Mapped[float] = mapped_column(Float)
    quality_grade: Mapped[str] = mapped_column(String(50))
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    expected_price: Mapped[float] = mapped_column(Float)
    available_from: Mapped[date] = mapped_column(Date)
    location: Mapped[str] = mapped_column(String(120))
    # Geocoded from `location` on create (best-effort; nullable when geocoding fails).
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open")
