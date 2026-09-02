"""Pydantic v2 schemas for the demand endpoints."""

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.services.grading import GRADE_CODES, normalize_grade

_MAX_QTY_KG = 10_000_000
_MAX_PRICE = 5_000_000


def _grade_min(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    g = normalize_grade(v)
    if g is None or g not in GRADE_CODES:
        raise ValueError(f"quality_grade_min must be one of {GRADE_CODES}")
    return g


def _qty(v: float) -> float:
    if v <= 0:
        raise ValueError("quantity_kg must be greater than 0")
    if v > _MAX_QTY_KG:
        raise ValueError("quantity_kg looks too large — enter kilograms")
    return v


def _price(v: float) -> float:
    if v <= 0:
        raise ValueError("price band values must be greater than 0")
    if v > _MAX_PRICE:
        raise ValueError("price looks too high — enter ₹ per quintal")
    return v


class DemandCreate(BaseModel):
    crop: str = Field(min_length=1, max_length=120)
    quantity_kg: float
    quality_spec: str = Field(min_length=1, max_length=500)
    quality_grade_min: str | None = None
    price_band_min: float
    price_band_max: float
    delivery_window: str = Field(min_length=1, max_length=120)
    # Optional — defaults to the buyer's own location on the server.
    delivery_district: str | None = Field(default=None, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @field_validator("crop", "quality_spec", "delivery_window")
    @classmethod
    def _strip_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("This field is required")
        return v

    @field_validator("delivery_district")
    @classmethod
    def _strip_district(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("quality_grade_min")
    @classmethod
    def _grade(cls, v: str | None) -> str | None:
        return _grade_min(v)

    @field_validator("quantity_kg")
    @classmethod
    def qty_positive(cls, v: float) -> float:
        return _qty(v)

    @field_validator("price_band_min", "price_band_max")
    @classmethod
    def _price_sane(cls, v: float) -> float:
        return _price(v)

    @model_validator(mode="after")
    def band_order(self) -> "DemandCreate":
        if self.price_band_max < self.price_band_min:
            raise ValueError("price_band_max must be >= price_band_min")
        return self


class DemandUpdate(BaseModel):
    """Fields a buyer may change on their own still-open demand. Crop is fixed."""

    quantity_kg: float | None = None
    quality_spec: str | None = Field(default=None, min_length=1, max_length=500)
    quality_grade_min: str | None = None
    price_band_min: float | None = None
    price_band_max: float | None = None
    delivery_window: str | None = Field(default=None, min_length=1, max_length=120)
    delivery_district: str | None = Field(default=None, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @field_validator("quantity_kg")
    @classmethod
    def _q(cls, v: float | None) -> float | None:
        return None if v is None else _qty(v)

    @field_validator("price_band_min", "price_band_max")
    @classmethod
    def _p(cls, v: float | None) -> float | None:
        return None if v is None else _price(v)

    @field_validator("quality_grade_min")
    @classmethod
    def _g(cls, v: str | None) -> str | None:
        return _grade_min(v)

    @field_validator("quality_spec", "delivery_window", "delivery_district")
    @classmethod
    def _s(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @model_validator(mode="after")
    def _band_order(self) -> "DemandUpdate":
        if (
            self.price_band_min is not None
            and self.price_band_max is not None
            and self.price_band_max < self.price_band_min
        ):
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
