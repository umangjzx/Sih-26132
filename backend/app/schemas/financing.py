"""Pydantic v2 schemas for warehouse-receipt-backed financing requests (v1.17)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

_MAX_AMOUNT = 50_000_000  # ₹5 crore ceiling — a sanity bound, not a real limit


class FinancingRequestCreate(BaseModel):
    lot_id: int
    requested_amount_inr: float = Field(gt=0, le=_MAX_AMOUNT)
    warehouse_name: str | None = Field(default=None, max_length=200)
    receipt_ref: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=1000)

    @field_validator("warehouse_name", "receipt_ref", "note")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class FinancingRequestReview(BaseModel):
    status: Literal["approved", "rejected"]
    admin_note: str | None = Field(default=None, max_length=1000)

    @field_validator("admin_note")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class FinancingRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    farmer_id: int
    lot_id: int
    requested_amount_inr: float
    warehouse_name: str | None
    receipt_ref: str | None
    note: str | None
    status: str
    admin_note: str | None
    reviewed_by: int | None
    reviewed_at: datetime | None
    created_at: datetime
    deal_id: int | None = None
    # enriched
    crop: str = ""
    farmer_name: str = ""
    max_eligible_inr: float = 0.0
