"""Pydantic v2 schemas for the per-deal logistics plan."""

from datetime import date, datetime, timedelta

from pydantic import BaseModel, ConfigDict, Field, field_validator

_MODES = ("self_pickup", "hired_transport", "buyer_arranged")
_STATUS = ("planned", "in_transit", "delivered")


def _valid_url_or_path(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    if not v:
        return None
    if len(v) > 500:
        raise ValueError("URL is too long")
    if not (v.startswith("https://") or v.startswith("http://") or v.startswith("/")):
        raise ValueError("must be an http(s) URL or a relative path")
    return v


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
    pod_url: str | None = None
    pod_confirmed_at: datetime | None = None
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
    est_cost_inr: float | None = Field(default=None, ge=0, le=100_000_000)
    status: str | None = Field(default=None)
    notes: str | None = Field(default=None, max_length=500)
    pod_url: str | None = Field(default=None, max_length=500)

    @field_validator("transporter_name", "transporter_phone", "vehicle_type",
                     "pickup_point", "drop_point", "notes")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("pickup_date")
    @classmethod
    def _pickup_sane(cls, v: date | None) -> date | None:
        if v is None:
            return None
        if v < date.today() - timedelta(days=90) or v > date.today() + timedelta(days=550):
            raise ValueError("pickup_date is out of a sensible range")
        return v

    @field_validator("pod_url")
    @classmethod
    def _pod(cls, v: str | None) -> str | None:
        return _valid_url_or_path(v)

    def cleaned(self) -> dict:
        d = self.model_dump(exclude_unset=True)
        if "mode" in d and d["mode"] not in _MODES:
            d.pop("mode")
        if "status" in d and d["status"] not in _STATUS:
            d.pop("status")
        # stamp the PoD confirmation time when a proof URL is first attached
        return d
