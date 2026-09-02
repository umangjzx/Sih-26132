"""Pydantic v2 schemas for the pooled-request (FPO) endpoints."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Absolute sanity ceilings — mirror app.schemas.offer so pool-materialised deals
# can never carry a value the 1:1 path would have rejected.
_MAX_QTY = 10_000_000      # kg
_MAX_PRICE = 5_000_000     # ₹/quintal
_GRADES = {"A", "B", "C"}


def _pos_qty(v: float) -> float:
    if v is None or v <= 0:
        raise ValueError("must be greater than 0")
    if v > _MAX_QTY:
        raise ValueError(f"must be at most {_MAX_QTY:,} kg")
    return round(float(v), 2)


def _pos_price(v: float) -> float:
    if v is None or v <= 0:
        raise ValueError("must be greater than 0")
    if v > _MAX_PRICE:
        raise ValueError(f"must be at most {_MAX_PRICE:,}")
    return round(float(v), 2)


class PoolCreate(BaseModel):
    crop: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    target_quantity_kg: float
    floor_price: float
    grade: str = "B"
    delivery_window: str = Field(default="", max_length=120)
    location: str = Field(default="", max_length=120)

    @field_validator("crop", "title", "delivery_window", "location")
    @classmethod
    def _strip(cls, v: str) -> str:
        return (v or "").strip()

    @field_validator("crop", "title")
    @classmethod
    def _required(cls, v: str) -> str:
        if not v:
            raise ValueError("must not be empty")
        return v

    @field_validator("grade")
    @classmethod
    def _grade(cls, v: str) -> str:
        v = (v or "B").strip().upper()
        if v not in _GRADES:
            raise ValueError(f"grade must be one of {sorted(_GRADES)}")
        return v

    @field_validator("target_quantity_kg")
    @classmethod
    def _target(cls, v: float) -> float:
        return _pos_qty(v)

    @field_validator("floor_price")
    @classmethod
    def _floor(cls, v: float) -> float:
        return _pos_price(v)


class PoolJoin(BaseModel):
    quantity_kg: float
    expected_price: float
    lot_id: int | None = None

    @field_validator("quantity_kg")
    @classmethod
    def _qty(cls, v: float) -> float:
        return _pos_qty(v)

    @field_validator("expected_price")
    @classmethod
    def _price(cls, v: float) -> float:
        return _pos_price(v)


class PoolStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def _known(cls, v: str) -> str:
        if v not in {"open", "locked", "matched", "closed"}:
            raise ValueError("unknown status")
        return v


class PoolAcceptDemand(BaseModel):
    demand_id: int
    agreed_price: float | None = None  # ₹/quintal; defaults to the pool's effective price

    @field_validator("agreed_price")
    @classmethod
    def _positive(cls, v: float | None) -> float | None:
        if v is None:
            return None
        return _pos_price(v)


class PoolDealResult(BaseModel):
    deal_id: int
    lot_id: int
    match_id: int
    agreed_price: float
    agreed_quantity_kg: float


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
    matched_deal_id: int | None = None
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
