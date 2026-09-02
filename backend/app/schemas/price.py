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


class SignalFactorOut(BaseModel):
    key: str            # price | arrivals | weather | forecast
    weight: int         # relative importance in the weighted sum
    score: int          # -1 / 0 / +1 for this factor
    contribution: int   # signed points added to total_score (weight * score)


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
    forecast_bias: int = 0
    forecast_note: str | None = None
    forecast_change_pct_7d: float | None = None
    total_score: int = 0
    factors: list[SignalFactorOut] = []


class ForecastPointOut(BaseModel):
    date: date
    yhat: float
    lo: float
    hi: float


class PriceForecastResponse(BaseModel):
    available: bool
    crop: str
    market: str
    method: str = ""
    horizon_days: int = 0
    last_price: float = 0.0
    trend_per_day: float = 0.0
    weekly_pattern: dict[int, float] = {}
    change_pct_7d: float | None = None
    change_pct_30d: float | None = None
    note: str = ""
    points: list[ForecastPointOut] = []


class IngestionResultResponse(BaseModel):
    source: str
    rows_upserted: int
    alerts_fired: int = 0
