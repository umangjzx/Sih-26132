from datetime import date

from sqlalchemy import Date, Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PriceCache(Base):
    """Daily mandi price snapshot, sourced from the data.gov.in AGMARKNET feed.

    Unique on (market, crop, variety, date) per the ingestion upsert key —
    the source dataset does not report arrival volume, so that column stays
    nullable and the sell/wait signal degrades gracefully when it's absent.
    """

    __tablename__ = "price_cache"
    __table_args__ = (UniqueConstraint("market", "crop", "variety", "date", name="uq_price_cache_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    crop: Mapped[str] = mapped_column(String(120), index=True)
    variety: Mapped[str] = mapped_column(String(120), default="")
    market: Mapped[str] = mapped_column(String(120), index=True)
    district: Mapped[str] = mapped_column(String(120), index=True)
    state: Mapped[str] = mapped_column(String(120), default="Maharashtra")
    date: Mapped[date] = mapped_column(Date, index=True)
    min_price: Mapped[float] = mapped_column(Float)
    max_price: Mapped[float] = mapped_column(Float)
    modal_price: Mapped[float] = mapped_column(Float)
    arrival_volume: Mapped[float | None] = mapped_column(Float, nullable=True)
