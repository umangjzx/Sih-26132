from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class GeoCache(Base):
    """Cached geocoding results (village/town name -> lat/lon + admin hierarchy).

    Keeps us within Open-Meteo's geocoding fair-use by never re-querying a name
    we have already resolved.
    """

    __tablename__ = "geo_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    query: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    display_name: Mapped[str] = mapped_column(String(300), default="")
    admin1: Mapped[str] = mapped_column(String(120), default="")
    admin2: Mapped[str] = mapped_column(String(120), default="")
    admin3: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
