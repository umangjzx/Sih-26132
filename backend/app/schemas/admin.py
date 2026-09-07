"""Admin moderation schemas (v1.18) — dedicated Listings/Demands and Disputes
surfaces, pulled out of the dashboard's read-only aggregates so an admin can
actually inspect and act on one lot, demand, or dispute directly.
"""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class AdminLotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    farmer_id: int
    farmer_name: str = ""
    crop: str
    quantity_kg: float
    quality_grade: str
    expected_price: float
    available_from: date
    location: str
    status: str


class AdminDemandOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    buyer_id: int
    buyer_name: str = ""
    crop: str
    quantity_kg: float
    quality_spec: str
    quality_grade_min: str | None
    price_band_min: float
    price_band_max: float
    delivery_window: str
    delivery_district: str
    status: str


class ModerationClose(BaseModel):
    """An admin force-closing a lot or demand needs to say why — same
    accountability bar as a dispute resolution note."""
    reason: str = Field(min_length=3, max_length=500)


class AdminDisputeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    deal_id: int
    raised_by: int
    raised_by_name: str = ""
    reason: str
    evidence_url: str | None = None
    status: str
    outcome: str | None = None
    resolution: str | None = None
    resolved_by: int | None = None
    resolved_by_name: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    # v1.11 — set when this dispute's deal is linked to an accepted
    # forward-contract commitment, so the UI can offer the penalty control.
    is_forward: bool = False
    forward_commitment_id: int | None = None
    forward_penalty_preview_inr: float | None = None
