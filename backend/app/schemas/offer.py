"""Pydantic v2 schemas for offer and deal endpoints."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class OfferCreate(BaseModel):
    price: float
    quantity: float
    message: str | None = None

    @field_validator("price")
    @classmethod
    def price_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("price must be greater than 0")
        return v

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("quantity must be greater than 0")
        return v


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
    created_at: datetime
