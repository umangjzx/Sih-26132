"""Pydantic v2 schemas for forward contracts (v1.6)."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.services.grading import GRADE_CODES, normalize_grade

_MAX_QTY = 10_000_000
_MAX_PRICE = 5_000_000


class ForwardBidCreate(BaseModel):
    crop: str
    quantity_kg: float
    price_min: float
    price_max: float
    delivery_from: date
    delivery_to: date
    delivery_district: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    quality_grade_min: str | None = None
    notes: str | None = None

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
    note: str | None = None

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
