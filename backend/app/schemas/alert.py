"""Schemas for price alerts and in-app notifications (v1.1)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

_MAX_THRESHOLD = 5_000_000  # ₹/quintal — same ceiling used elsewhere


class PriceAlertCreate(BaseModel):
    crop: str = Field(min_length=1, max_length=120)
    market: str = Field(min_length=1, max_length=120)
    direction: str = "above"
    threshold: float

    @field_validator("crop", "market")
    @classmethod
    def _strip_required(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("must not be empty")
        return v

    @field_validator("direction")
    @classmethod
    def _dir(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("above", "below"):
            raise ValueError("direction must be 'above' or 'below'")
        return v

    @field_validator("threshold")
    @classmethod
    def _pos(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("threshold must be greater than 0")
        if v > _MAX_THRESHOLD:
            raise ValueError(f"threshold must be at most {_MAX_THRESHOLD:,}")
        return round(float(v), 2)


class PriceAlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    crop: str
    market: str
    direction: str
    threshold: float
    active: bool
    last_triggered_at: datetime | None
    created_at: datetime


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    title: str
    body: str
    link: str | None
    read: bool
    created_at: datetime
