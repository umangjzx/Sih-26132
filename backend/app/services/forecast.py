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


@dataclass
class SecondOpinion:
    """A second, independently-computed forecast (v1.16) shown *alongside*
    the primary trend+seasonality one above — never replacing it. See
    `second_opinion()`'s docstring for why Holt smoothing and not a real ML
    model."""
    available: bool
    method: str = "holt-linear-smoothing"
    change_pct_7d: float | None = None
    change_pct_30d: float | None = None
    agrees_with_primary: bool | None = None
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


# --------------------------------------------------------------------------- #
# v1.16 — a second opinion, shown alongside the primary forecast above.
#
# The codebase deliberately avoids heavy ML dependencies everywhere else
# (PBKDF2 over bcrypt, TF-IDF over sentence-transformers, no forecast
# library here either) — so the "second opinion" is Holt's linear (double)
# exponential smoothing, not a real ML model. It's a genuinely different
# *method*, not just a restatement: the primary forecast fits one straight
# line to a fixed 45-day window and refits it fresh on every call, while Holt
# smoothing carries a running level+trend forward with exponentially decaying
# weights, so it reacts to a recent turn a fixed-window OLS fit can miss, at
# the cost of being noisier on a short or choppy series. Comparing the two
# is more informative than either alone — hence "second opinion", not
# "replacement".
# --------------------------------------------------------------------------- #

def _holt_linear(values: list[float], alpha: float = 0.3, beta: float = 0.15) -> tuple[float, float]:
    """Fit Holt's linear trend method to `values` (chronological order).
    Returns the final (level, trend). alpha/beta are the standard smoothing
    constants (higher = more weight on recent observations)."""
    level = values[0]
    trend = values[1] - values[0] if len(values) > 1 else 0.0
    for v in values[1:]:
        prev_level = level
        level = alpha * v + (1 - alpha) * (level + trend)
        trend = beta * (level - prev_level) + (1 - beta) * trend
    return level, trend


def second_opinion(
    series: list[tuple[date, float]], horizon: int = 30, primary: Forecast | None = None
) -> SecondOpinion:
    """Holt-smoothed second opinion for the same series `forecast_prices`
    used. `primary`, if given, lets the note say whether the two methods
    agree on direction."""
    series = [(d, float(p)) for d, p in series if p and p > 0]
    if len(series) < MIN_POINTS:
        return SecondOpinion(available=False, note="Not enough history to forecast.")

    series.sort(key=lambda t: t[0])
    values = [p for _, p in series[-TREND_WINDOW:]]
    level, trend = _holt_linear(values)
    last_price = values[-1]

    def _yhat(h: int) -> float:
        return max(level + trend * h, last_price * 0.4)  # same implausibility guard as the primary

    def _chg(h: int) -> float | None:
        if not last_price:
            return None
        return round((_yhat(h) - last_price) / last_price * 100, 1)

    c7 = _chg(min(7, horizon))
    c30 = _chg(min(30, horizon)) if horizon >= 30 else None

    agrees: bool | None = None
    if primary is not None and primary.available and primary.change_pct_7d is not None and c7 is not None:
        agrees = (primary.change_pct_7d >= 0) == (c7 >= 0)

    if c7 is None:
        note = ""
    elif agrees is False:
        note = f"Diverges from the primary forecast — recent momentum alone points {c7:+.1f}% over 7 days."
    elif c7 >= 3:
        note = f"Recent momentum agrees — also pointing up, about +{c7:.1f}% over 7 days."
    elif c7 <= -3:
        note = f"Recent momentum agrees — also pointing down, about {c7:.1f}% over 7 days."
    else:
        note = f"Recent momentum looks flat too ({c7:+.1f}%)."

    return SecondOpinion(
        available=True,
        change_pct_7d=c7,
        change_pct_30d=c30,
        agrees_with_primary=agrees,
        note=note,
    )
