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
    """Per-user combined history (D-08). Populated by a later plan's endpoint."""

    lots: list[LotResponse] = Field(default_factory=list)
    demands: list[DemandResponse] = Field(default_factory=list)
    deals: list[DealDetailResponse] = Field(default_factory=list)
