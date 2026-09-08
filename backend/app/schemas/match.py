"""Pydantic v2 schemas for match and related summary responses."""

from datetime import date, datetime

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
    # Only the small (~96px) thumbnail, never the full photo_url — this
    # shape backs list endpoints (GET /api/matches/mine, /api/deals/mine,
    # /api/history) where every row would otherwise embed the full
    # compressed photo even though the UI only ever renders it at
    # thumbnail size (see Lot.photo_thumb_url).
    photo_thumb_url: str | None = None


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
    # v1.22 — a trust signal beyond the binary verified badge: a real deal
    # history and how long they've actually been on the platform.
    completed_deals: int = 0
    member_since: date


class MatchResponse(BaseModel):
    """Assembled manually in the endpoint — not from_attributes."""

    id: int
    lot: LotSummary
    demand: DemandSummary
    score: float
    score_detail: str | None
    status: str
    created_at: datetime
    counterparty: CounterpartySummary | None = None
