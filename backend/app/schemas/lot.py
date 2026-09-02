"""Pydantic v2 schemas for the lot endpoints."""

from datetime import date, timedelta

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.grading import GRADE_CODES, normalize_grade

_MAX_QTY_KG = 10_000_000
_MAX_PRICE = 5_000_000


def _valid_photo_url(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    if not v:
        return None
    if len(v) > 500:
        raise ValueError("photo_url is too long")
    # http(s) or a same-origin relative path only — no javascript:/data:/file:
    if not (v.startswith("https://") or v.startswith("http://") or v.startswith("/")):
        raise ValueError("photo_url must be an http(s) URL or a relative path")
    return v


def _valid_grade(v: str) -> str:
    g = normalize_grade(v)
    if g is None:
        raise ValueError(f"quality_grade must be one of {GRADE_CODES}")
    return g


def _valid_qty(v: float) -> float:
    if v <= 0:
        raise ValueError("quantity_kg must be greater than 0")
    if v > _MAX_QTY_KG:
        raise ValueError("quantity_kg looks too large — enter kilograms")
    return v


def _valid_price(v: float) -> float:
    if v <= 0:
        raise ValueError("expected_price must be greater than 0")
    if v > _MAX_PRICE:
        raise ValueError("expected_price looks too high — enter ₹ per quintal")
    return v


def _valid_avail_date(v: date) -> date:
    if v > date.today() + timedelta(days=550):
        raise ValueError("available_from is too far in the future")
    return v


class LotCreate(BaseModel):
    crop: str = Field(min_length=1, max_length=120)
    quantity_kg: float
    quality_grade: str
    expected_price: float
    available_from: date
    location: str = Field(min_length=1, max_length=120)
    photo_url: str | None = None

    @field_validator("crop", "location")
    @classmethod
    def _strip_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("This field is required")
        return v

    @field_validator("quality_grade")
    @classmethod
    def qgrade(cls, v: str) -> str:
        return _valid_grade(v)

    @field_validator("quantity_kg")
    @classmethod
    def qty_positive(cls, v: float) -> float:
        return _valid_qty(v)

    @field_validator("expected_price")
    @classmethod
    def price_positive(cls, v: float) -> float:
        return _valid_price(v)

    @field_validator("available_from")
    @classmethod
    def date_sane(cls, v: date) -> date:
        return _valid_avail_date(v)

    @field_validator("photo_url")
    @classmethod
    def photo(cls, v: str | None) -> str | None:
        return _valid_photo_url(v)


class LotUpdate(BaseModel):
    """Fields a farmer may change on their own still-open lot. Crop is fixed —
    list a new lot instead of re-purposing one."""

    quantity_kg: float | None = None
    quality_grade: str | None = None
    expected_price: float | None = None
    available_from: date | None = None
    location: str | None = Field(default=None, min_length=1, max_length=120)
    photo_url: str | None = None

    @field_validator("quantity_kg")
    @classmethod
    def _qty(cls, v: float | None) -> float | None:
        return None if v is None else _valid_qty(v)

    @field_validator("expected_price")
    @classmethod
    def _price(cls, v: float | None) -> float | None:
        return None if v is None else _valid_price(v)

    @field_validator("quality_grade")
    @classmethod
    def _grade(cls, v: str | None) -> str | None:
        return None if v is None else _valid_grade(v)

    @field_validator("available_from")
    @classmethod
    def _date(cls, v: date | None) -> date | None:
        return None if v is None else _valid_avail_date(v)

    @field_validator("location")
    @classmethod
    def _loc(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("photo_url")
    @classmethod
    def _photo(cls, v: str | None) -> str | None:
        return _valid_photo_url(v)


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
