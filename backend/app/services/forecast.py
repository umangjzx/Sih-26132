"""Interpretable price forecast — trend + weekly-seasonality decomposition.

No ML library, no black box: we fit a straight-line trend to the recent window
by least squares, learn the typical day-of-week offset from the residuals, and
project both forward. Every number is inspectable and the method degrades to
"unavailable" when a series is too short. Feeds a factor into the sell/wait
signal and the dashed forecast line on the trend chart.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from statistics import mean, pstdev

MIN_POINTS = 14
TREND_WINDOW = 45          # days of history the trend line is fit to
_Z80 = 1.2816              # ~80% prediction interval


@dataclass
class ForecastPoint:
    date: date
    yhat: float
    lo: float
    hi: float


@dataclass
class Forecast:
    available: bool
    method: str = "trend+weekly-seasonality"
    horizon_days: int = 0
    last_price: float = 0.0
    trend_per_day: float = 0.0            # ₹/day slope of the fitted line
    weekly_pattern: dict[int, float] = field(default_factory=dict)  # weekday -> ₹ offset
    residual_std: float = 0.0
    points: list[ForecastPoint] = field(default_factory=list)
    change_pct_7d: float | None = None
    change_pct_30d: float | None = None
    note: str = ""


def _linfit(xs: list[float], ys: list[float]) -> tuple[float, float]:
    """Least-squares slope, intercept for y = slope*x + intercept."""
    n = len(xs)
    mx, my = mean(xs), mean(ys)
    denom = sum((x - mx) ** 2 for x in xs) or 1e-9
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / denom
    return slope, my - slope * mx


def forecast_prices(series: list[tuple[date, float]], horizon: int = 30) -> Forecast:
    """`series` is (date, modal_price) ascending. Returns a Forecast."""
    series = [(d, float(p)) for d, p in series if p and p > 0]
    if len(series) < MIN_POINTS:
        return Forecast(available=False, note="Not enough history to forecast.")

    series.sort(key=lambda t: t[0])
    window = series[-TREND_WINDOW:]
    base = window[0][0]
    xs = [(d - base).days for d, _ in window]
    ys = [p for _, p in window]

    slope, intercept = _linfit([float(x) for x in xs], ys)

    # day-of-week offsets from the de-trended residuals, centred to sum ~0
    by_dow: dict[int, list[float]] = {}
    for (d, p), x in zip(window, xs):
        by_dow.setdefault(d.weekday(), []).append(p - (slope * x + intercept))
    raw = {k: mean(v) for k, v in by_dow.items()}
    offset = mean(raw.values()) if raw else 0.0
    weekly = {k: round(v - offset, 2) for k, v in raw.items()}

    residuals = [
        p - (slope * x + intercept + weekly.get(d.weekday(), 0.0))
        for (d, p), x in zip(window, xs)
    ]
    rstd = pstdev(residuals) if len(residuals) > 1 else 0.0

    last_date, last_price = series[-1]
    last_x = (last_date - base).days
    pts: list[ForecastPoint] = []
    for i in range(1, horizon + 1):
        fd = last_date + timedelta(days=i)
        fx = last_x + i
        yhat = slope * fx + intercept + weekly.get(fd.weekday(), 0.0)
        yhat = max(yhat, last_price * 0.4)  # never project an implausible collapse
        band = _Z80 * rstd * (1 + i / max(len(window), 1)) ** 0.5
        pts.append(ForecastPoint(fd, round(yhat, 2), round(yhat - band, 2), round(yhat + band, 2)))

    def _chg(day: int) -> float | None:
        if day <= len(pts) and last_price:
            return round((pts[day - 1].yhat - last_price) / last_price * 100, 1)
        return None

    c7, c30 = _chg(7), _chg(30)
    if c7 is None:
        note = ""
    elif c7 >= 3:
        note = f"Prices are trending up — about +{c7:.1f}% expected over the next 7 days."
    elif c7 <= -3:
        note = f"Prices are trending down — about {c7:.1f}% expected over the next 7 days."
    else:
        note = f"Prices look flat over the next 7 days ({c7:+.1f}%)."

    return Forecast(
        available=True,
        horizon_days=horizon,
        last_price=round(last_price, 2),
        trend_per_day=round(slope, 2),
        weekly_pattern=weekly,
        residual_std=round(rstd, 2),
        points=pts,
        change_pct_7d=c7,
        change_pct_30d=c30,
        note=note,
    )
