"""Pydantic v2 schemas for the lot endpoints."""

from datetime import date

from pydantic import BaseModel, ConfigDict, field_validator

from app.services.grading import GRADE_CODES, normalize_grade


class LotCreate(BaseModel):
    crop: str
    quantity_kg: float
    quality_grade: str
    expected_price: float
    available_from: date
    location: str
    photo_url: str | None = None

    @field_validator("quality_grade")
    @classmethod
    def _grade(cls, v: str) -> str:
        g = normalize_grade(v)
        if g is None:
            raise ValueError(f"quality_grade must be one of {GRADE_CODES}")
        return g

    @field_validator("quantity_kg")
    @classmethod
    def qty_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("quantity_kg must be greater than 0")
        if v > 10_000_000:
            raise ValueError("quantity_kg looks too large — enter kilograms")
        return v

    @field_validator("expected_price")
    @classmethod
    def price_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("expected_price must be greater than 0")
        if v > 5_000_000:
            raise ValueError("expected_price looks too high — enter ₹ per quintal")
        return v


class LotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    farmer_id: int
    crop: str
    quantity_kg: float
    quality_grade: str
    photo_url: str | None
    expected_price: float
    available_from: date
    location: str
    latitude: float | None = None
    longitude: float | None = None
    status: str


class BrowseLotOut(BaseModel):
    id: int
    crop: str
    quantity_kg: float
    quality_grade: str
    expected_price: float
    available_from: date
    location: str
    distance_km: float | None = None
    farmer_id: int
    farmer_name: str
    farmer_district: str
    farmer_verified: bool = False


class ExpressInterestResult(BaseModel):
    matched: bool
    match_id: int | None = None
    score: float | None = None
    reason: str | None = None
