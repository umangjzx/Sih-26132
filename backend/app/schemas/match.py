"""Pydantic v2 schemas for match and related summary responses."""

from datetime import date

from pydantic import BaseModel


class LotSummary(BaseModel):
    id: int
    farmer_id: int
    crop: str
    quantity_kg: float
    quality_grade: str
    expected_price: float
    location: str
    status: str


class DemandSummary(BaseModel):
    id: int
    crop: str
    quantity_kg: float
    price_band_min: float
    price_band_max: float
    delivery_window: str
    status: str


class CounterpartySummary(BaseModel):
    id: int
    name: str
    district: str
    kyc_status: str
    verification_status: str = "unverified"


class MatchResponse(BaseModel):
    """Assembled manually in the endpoint — not from_attributes."""

    id: int
    lot: LotSummary
    demand: DemandSummary
    score: float
    score_detail: str | None
    status: str
    counterparty: CounterpartySummary | None = None
