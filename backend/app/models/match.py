from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Match(Base):
    """status: proposed | offered | accepted | rejected."""

    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lot_id: Mapped[int] = mapped_column(ForeignKey("lots.id"))
    demand_id: Mapped[int] = mapped_column(ForeignKey("demands.id"))
    score: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="proposed")
    # JSON string storing per-component score breakdown for explainability (Phase 2).
    score_detail: Mapped[str | None] = mapped_column(String(1000), nullable=True)
