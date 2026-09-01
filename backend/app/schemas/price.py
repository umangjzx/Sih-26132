from datetime import date

from pydantic import BaseModel


class CropMarketOption(BaseModel):
    crop: str
    market: str
    district: str
    state: str = ""


class PricePoint(BaseModel):
    date: date
    min_price: float
    max_price: float
    modal_price: float
    arrival_volume: float | None = None


class PriceTrendResponse(BaseModel):
    crop: str
    market: str
    district: str
    points: list[PricePoint]


class NearestMarketComparison(BaseModel):
    market: str
    district: str
    distance_km: float | None
    modal_price: float
    date: date


class SellWaitSignalResponse(BaseModel):
    recommendation: str
    reasons: list[str]
    current_price: float
    ma_7: float
    ma_30: float | None
    volume_trend_pct: float | None
    days_of_data: int
    weather_bias: int = 0
    weather_note: str | None = None
    msp: dict | None = None


class IngestionResultResponse(BaseModel):
    source: str
    rows_upserted: int
    alerts_fired: int = 0
