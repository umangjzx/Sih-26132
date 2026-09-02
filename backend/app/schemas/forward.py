"""Pydantic v2 schemas for forward contracts (v1.6)."""

from datetime import date, datetime, timedelta

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.services.grading import GRADE_CODES, normalize_grade

_MAX_QTY = 10_000_000
_MAX_PRICE = 5_000_000
_MAX_READY_DAYS = 550  # ~18 months — same ceiling lots use for available_from


class ForwardBidCreate(BaseModel):
    crop: str = Field(min_length=1, max_length=120)
    quantity_kg: float
    price_min: float
    price_max: float
    delivery_from: date
    delivery_to: date
    delivery_district: str | None = Field(default=None, max_length=120)
    latitude: float | None = None
    longitude: float | None = None
    quality_grade_min: str | None = None
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("crop")
    @classmethod
    def _crop(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("crop must not be empty")
        return v

    @field_validator("delivery_district", "notes")
    @classmethod
    def _strip_opt(cls, v: str | None) -> str | None:
        return (v or "").strip() or None

    @field_validator("quantity_kg")
    @classmethod
    def _qty(cls, v: float) -> float:
        if v <= 0 or v > _MAX_QTY:
            raise ValueError("quantity_kg out of range")
        return v

    @field_validator("price_min", "price_max")
    @classmethod
    def _price(cls, v: float) -> float:
        if v <= 0 or v > _MAX_PRICE:
            raise ValueError("price out of range")
        return v

    @field_validator("quality_grade_min")
    @classmethod
    def _grade(cls, v: str | None) -> str | None:
        if not v:
            return None
        g = normalize_grade(v)
        if g is None or g not in GRADE_CODES:
            raise ValueError(f"quality_grade_min must be one of {GRADE_CODES}")
        return g

    @model_validator(mode="after")
    def _consistency(self) -> "ForwardBidCreate":
        if self.price_max < self.price_min:
            raise ValueError("price_max must be >= price_min")
        if self.delivery_to < self.delivery_from:
            raise ValueError("delivery_to must be on or after delivery_from")
        if self.delivery_from < date.today():
            raise ValueError("delivery_from must be in the future")
        return self


class ForwardCommitmentCreate(BaseModel):
    quantity_kg: float
    price_per_qtl: float
    expected_ready: date
    note: str | None = Field(default=None, max_length=1000)

    @field_validator("note")
    @classmethod
    def _note(cls, v: str | None) -> str | None:
        return (v or "").strip() or None

    @field_validator("quantity_kg")
    @classmethod
    def _qty(cls, v: float) -> float:
        if v <= 0 or v > _MAX_QTY:
            raise ValueError("quantity_kg out of range")
        return v

    @field_validator("price_per_qtl")
    @classmethod
    def _price(cls, v: float) -> float:
        if v <= 0 or v > _MAX_PRICE:
            raise ValueError("price out of range")
        return v

    @field_validator("expected_ready")
    @classmethod
    def _ready(cls, v: date) -> date:
        today = date.today()
        if v < today:
            raise ValueError("expected_ready cannot be in the past")
        if v > today + timedelta(days=_MAX_READY_DAYS):
            raise ValueError("expected_ready is unrealistically far in the future")
        return v


class ForwardCommitmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    bid_id: int
    farmer_id: int
    quantity_kg: float
    price_per_qtl: float
    expected_ready: date
    note: str | None
    status: str
    deal_id: int | None
    created_at: datetime
    # enriched
    farmer_name: str = ""
    farmer_district: str = ""
    farmer_verified: bool = False
    calendar_warning: str | None = None


class ForwardBidOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    buyer_id: int
    crop: str
    quantity_kg: float
    price_min: float
    price_max: float
    delivery_from: date
    delivery_to: date
    delivery_district: str
    latitude: float | None
    longitude: float | None
    quality_grade_min: str | None
    notes: str | None
    status: str
    created_at: datetime
    # enriched
    buyer_name: str = ""
    buyer_verified: bool = False
    distance_km: float | None = None
    committed_kg: float = 0.0
    accepted_kg: float = 0.0
    remaining_kg: float = 0.0
    fill_pct: float = 0.0
    my_commitment: ForwardCommitmentOut | None = None
    harvest_window: str | None = None


class ForwardBidDetail(ForwardBidOut):
    commitments: list[ForwardCommitmentOut] = []


class ForwardCommitmentResult(BaseModel):
    commitment_id: int
    status: str
    deal_id: int | None = None
