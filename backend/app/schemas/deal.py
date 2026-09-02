"""Pydantic v2 schemas for deal-detail, dispute, and history responses (Phase 3).

Design (from 3-CONTEXT.md D-10, D-11):
- ``DealDetailResponse`` extends ``DealResponse`` (app.schemas.offer) with the
  nested lot / demand / counterparty summaries, assembled manually in the
  endpoint (no ORM relationships) — same pattern as ``MatchResponse``.
- ``DisputeCreate`` validates a non-empty reason, max 1000 chars.
- ``HistoryResponse`` is defined here as the shared shape for a later history
  endpoint (D-08); this plan only ships the deal + dispute routers.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.demand import DemandResponse
from app.schemas.lot import LotResponse
from app.schemas.match import CounterpartySummary, DemandSummary, LotSummary
from app.schemas.offer import DealResponse


class DealDetailResponse(DealResponse):
    """All ``DealResponse`` fields plus manually-assembled nested summaries."""

    lot: LotSummary
    demand: DemandSummary
    counterparty: CounterpartySummary | None = None


class DisputeCreate(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("reason must not be empty")
        if len(v) > 1000:
            raise ValueError("reason must be at most 1000 characters")
        return v


class DisputeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    deal_id: int
    raised_by: int
    reason: str
    status: str
    created_at: datetime


class HistoryResponse(BaseModel):
    """Per-user combined history (D-08)."""

    lots: list[LotResponse] = Field(default_factory=list)
    demands: list[DemandResponse] = Field(default_factory=list)
    deals: list[DealDetailResponse] = Field(default_factory=list)


class PriceTrendPoint(BaseModel):
    """One day of the admin dashboard's 30-day average-modal-price series (D-09)."""

    date: str  # ISO date string
    avg_modal_price: float


class DisputeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    deal_id: int
    raised_by: int
    reason: str
    status: str
    created_at: datetime


class DistrictPriceGap(BaseModel):
    district: str
    avg_modal_price: float
    gap_vs_state_pct: float   # negative => that district's farmers see below-state prices


class PriceAnomaly(BaseModel):
    crop: str
    market: str
    modal_price: float
    avg_7d: float
    deviation_pct: float


class AdminDashboardResponse(BaseModel):
    """Read-only aggregate view for admins (D-09 + v1.1 analytics)."""

    total_lots: int
    open_lots: int
    total_demands: int
    open_demands: int
    total_deals: int
    open_disputes_count: int
    price_trend_summary: list[PriceTrendPoint] = Field(default_factory=list)
    dispute_queue: list[DisputeSummary] = Field(default_factory=list)
    # v1.1 analytics
    district_price_gaps: list[DistrictPriceGap] = Field(default_factory=list)
    disputes_by_district: dict[str, int] = Field(default_factory=dict)
    price_anomalies: list[PriceAnomaly] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# v1.3 admin analytics (GET /api/admin/analytics) — charts & insight blocks
# --------------------------------------------------------------------------- #

class FunnelStage(BaseModel):
    stage: str
    count: int


class CropSupplyDemand(BaseModel):
    crop: str
    supply_kg: float
    demand_kg: float
    open_lots: int
    open_demands: int
    tightness: float  # demand / max(supply, 1) — >1 means demand outstrips supply


class ScoreBucket(BaseModel):
    label: str       # "75-100"
    count: int


class WeeklyPoint(BaseModel):
    week: str         # ISO date of the week's Monday
    deals: int
    offers: int
    new_users: int


class PriceVsMsp(BaseModel):
    crop: str
    modal_price: float
    msp: float
    gap_pct: float                                # (modal - msp) / msp * 100


class PricePulse(BaseModel):
    crop: str
    latest: float
    avg_30d: float
    change_pct: float


class AdminAnalyticsResponse(BaseModel):
    # headline KPIs
    gmv_inr: float                       # Σ agreed_price/qtl × agreed_qty(kg)/100
    avg_deal_value_inr: float
    users_total: int
    users_by_role: dict[str, int]
    markets_tracked: int
    districts_tracked: int
    states_tracked: int
    price_index_latest: float            # mean modal price, latest day
    price_index_change_pct: float        # vs ~30 days ago
    match_conversion_pct: float          # deals / matches
    # charts
    funnel: list[FunnelStage] = Field(default_factory=list)
    deal_pipeline: dict[str, int] = Field(default_factory=dict)
    supply_demand: list[CropSupplyDemand] = Field(default_factory=list)
    score_distribution: list[ScoreBucket] = Field(default_factory=list)
    weekly_activity: list[WeeklyPoint] = Field(default_factory=list)
    price_pulse: list[PricePulse] = Field(default_factory=list)
    lots_by_crop: dict[str, int] = Field(default_factory=dict)
    demands_by_crop: dict[str, int] = Field(default_factory=dict)
    # v1.4 phase 4 additions
    deal_success_rate_pct: float = 0.0            # closed / created deals
    payment_status_split: dict[str, int] = Field(default_factory=dict)  # pending | paid
    avg_hours_to_deal: float | None = None        # first offer -> deal
    price_vs_msp: list[PriceVsMsp] = Field(default_factory=list)
