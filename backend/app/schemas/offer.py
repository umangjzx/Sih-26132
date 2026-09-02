"""Pydantic v2 schemas for offer and deal endpoints."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

_MAX_PRICE = 5_000_000       # ₹ / quintal
_MAX_QTY = 10_000_000        # kg


class OfferCreate(BaseModel):
    price: float
    quantity: float
    message: str | None = Field(default=None, max_length=1000)

    @field_validator("price")
    @classmethod
    def price_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("price must be greater than 0")
        if v > _MAX_PRICE:
            raise ValueError("price looks too high — enter ₹ per quintal")
        return v

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("quantity must be greater than 0")
        if v > _MAX_QTY:
            raise ValueError("quantity looks too large — enter kilograms")
        return v

    @field_validator("message")
    @classmethod
    def _msg(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class OfferResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    match_id: int
    from_user_id: int
    price: float
    quantity: float
    message: str | None
    status: str
    created_at: datetime


class DealResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    match_id: int
    agreed_price: float
    agreed_quantity: float
    logistics_mode: str
    payment_status: str
    pipeline_status: str
    payment_method: str | None = None
    payment_reference: str | None = None
    created_at: datetime
