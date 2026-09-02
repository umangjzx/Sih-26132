"""Pydantic v2 schemas for the pooled-request (FPO) endpoints."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class PoolCreate(BaseModel):
    crop: str
    title: str
    target_quantity_kg: float
    floor_price: float
    grade: str = "B"
    delivery_window: str = ""
    location: str = ""

    @field_validator("target_quantity_kg", "floor_price")
    @classmethod
    def _positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("must be greater than 0")
        return v


class PoolJoin(BaseModel):
    quantity_kg: float
    expected_price: float
    lot_id: int | None = None

    @field_validator("quantity_kg", "expected_price")
    @classmethod
    def _positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("must be greater than 0")
        return v


class PoolStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def _known(cls, v: str) -> str:
        if v not in {"open", "locked", "matched", "closed"}:
            raise ValueError("unknown status")
        return v


class PoolMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    farmer_id: int
    farmer_name: str | None = None
    lot_id: int | None
    quantity_kg: float
    expected_price: float
    status: str


class PoolSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organizer_id: int
    organizer_name: str | None = None
    crop: str
    title: str
    target_quantity_kg: float
    floor_price: float
    grade: str
    delivery_window: str
    location: str
    status: str
    created_at: datetime
    members: int = 0
    committed_quantity_kg: float = 0.0
    fill_pct: float = 0.0


class PoolAggregate(BaseModel):
    members: int
    quantity_kg: float
    weighted_price: float
    floor_price: float
    effective_price: float
    fill_pct: float
    target_quantity_kg: float


class DemandCandidate(BaseModel):
    demand_id: int
    buyer_name: str
    buyer_district: str
    buyer_kyc: str
    quantity_kg: float
    price_band_min: float
    price_band_max: float
    delivery_window: str
    score: float
    tier: str
    score_detail: str


class PoolDetail(PoolSummary):
    aggregate: PoolAggregate
    member_list: list[PoolMemberOut] = []
    candidates: list[DemandCandidate] = []
    is_organizer: bool = False
    my_membership: PoolMemberOut | None = None
