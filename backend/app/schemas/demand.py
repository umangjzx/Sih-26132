"""Pydantic v2 schemas for the demand endpoints."""

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.services.grading import GRADE_CODES, normalize_grade


class DemandCreate(BaseModel):
    crop: str
    quantity_kg: float
    quality_spec: str
    quality_grade_min: str | None = None
    price_band_min: float
    price_band_max: float
    delivery_window: str
    # Optional — defaults to the buyer's own location on the server.
    delivery_district: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    @field_validator("quality_grade_min")
    @classmethod
    def _grade(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        g = normalize_grade(v)
        if g is None or g not in GRADE_CODES:
            raise ValueError(f"quality_grade_min must be one of {GRADE_CODES}")
        return g

    @field_validator("quantity_kg")
    @classmethod
    def qty_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("quantity_kg must be greater than 0")
        if v > 10_000_000:
            raise ValueError("quantity_kg looks too large — enter kilograms")
        return v

    @field_validator("price_band_min", "price_band_max")
    @classmethod
    def _price_sane(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("price band values must be greater than 0")
        if v > 5_000_000:
            raise ValueError("price looks too high — enter ₹ per quintal")
        return v

    @model_validator(mode="after")
    def band_order(self) -> "DemandCreate":
        if self.price_band_max < self.price_band_min:
            raise ValueError("price_band_max must be >= price_band_min")
        return self


class DemandResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    buyer_id: int
    crop: str
    quantity_kg: float
    quality_spec: str
    quality_grade_min: str | None = None
    price_band_min: float
    price_band_max: float
    delivery_window: str
    status: str
    delivery_district: str = ""
    latitude: float | None = None
    longitude: float | None = None


class BrowseDemandOut(BaseModel):
    id: int
    crop: str
    quantity_kg: float
    quality_spec: str
    quality_grade_min: str | None = None
    price_band_min: float
    price_band_max: float
    delivery_window: str
    delivery_district: str
    distance_km: float | None = None
    buyer_id: int
    buyer_name: str
    buyer_district: str
    buyer_verified: bool = False
