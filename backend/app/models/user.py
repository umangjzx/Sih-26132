from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class User(Base):
    """role: farmer | buyer | admin. kyc_status: a stub flag, not real verification."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    district: Mapped[str] = mapped_column(String(120))
    taluka: Mapped[str] = mapped_column(String(120))
    kyc_status: Mapped[str] = mapped_column(String(20), default="unverified")
