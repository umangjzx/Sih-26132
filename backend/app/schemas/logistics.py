"""Pydantic v2 schemas for the per-deal logistics plan."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

_MODES = ("self_pickup", "hired_transport", "buyer_arranged")
_STATUS = ("planned", "in_transit", "delivered")


class LogisticsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    deal_id: int
    mode: str = "hired_transport"
    transporter_name: str | None = None
    transporter_phone: str | None = None
    vehicle_type: str | None = None
    pickup_date: date | None = None
    pickup_point: str | None = None
    drop_point: str | None = None
    distance_km: float | None = None
    est_cost_inr: float | None = None
    status: str = "planned"
    notes: str | None = None
    updated_at: datetime | None = None
    # true when the row is a server-side suggestion, not saved yet
    is_draft: bool = False


class LogisticsUpdate(BaseModel):
    mode: str | None = Field(default=None)
    transporter_name: str | None = Field(default=None, max_length=160)
    transporter_phone: str | None = Field(default=None, max_length=20)
    vehicle_type: str | None = Field(default=None, max_length=40)
    pickup_date: date | None = None
    pickup_point: str | None = Field(default=None, max_length=200)
    drop_point: str | None = Field(default=None, max_length=200)
    est_cost_inr: float | None = Field(default=None, ge=0)
    status: str | None = Field(default=None)
    notes: str | None = Field(default=None, max_length=500)

    def cleaned(self) -> dict:
        d = self.model_dump(exclude_unset=True)
        if "mode" in d and d["mode"] not in _MODES:
            d.pop("mode")
        if "status" in d and d["status"] not in _STATUS:
            d.pop("status")
        return d
