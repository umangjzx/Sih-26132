"""Pydantic v2 schemas for the lot endpoints."""

from datetime import date

from pydantic import BaseModel, ConfigDict, field_validator


class LotCreate(BaseModel):
    crop: str
    quantity_kg: float
    quality_grade: str
    expected_price: float
    available_from: date
    location: str
    photo_url: str | None = None

    @field_validator("quantity_kg")
    @classmethod
    def qty_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("quantity_kg must be greater than 0")
        return v

    @field_validator("expected_price")
    @classmethod
    def price_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("expected_price must be greater than 0")
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
    status: str
