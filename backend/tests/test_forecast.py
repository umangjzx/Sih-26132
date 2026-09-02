"""Interpretable price forecast: trend + weekly-seasonality decomposition,
and the forecast factor it feeds into compute_signal.
"""

from datetime import date, timedelta

from app.models.price_cache import PriceCache
from app.services.forecast import MIN_POINTS, forecast_prices
from app.services.signal import compute_signal


def _rows(prices: list[float]):
    start = date.today() - timedelta(days=len(prices) - 1)
    return [
        PriceCache(crop="Onion", variety="", market="Pune", district="Pune",
                   state="Maharashtra", date=start + timedelta(days=i),
                   min_price=p - 50, max_price=p + 50, modal_price=p, arrival_volume=None)
        for i, p in enumerate(prices)
    ]


def test_short_series_is_unavailable():
    f = forecast_prices([(date.today(), 100.0)] * (MIN_POINTS - 1))
    assert f.available is False


def test_detects_uptrend_and_weekly_pattern():
    start = date.today() - timedelta(days=50)
    series = []
    p = 1000.0
    for i in range(50):
        p += 8  # +₹8/day
        d = start + timedelta(days=i)
        series.append((d, p + (120 if d.weekday() == 0 else 0)))  # Monday bump
    f = forecast_prices(series, horizon=30)
    assert f.available and f.trend_per_day > 5
    assert f.weekly_pattern[0] > 50            # Monday offset learned
    assert f.change_pct_7d and f.change_pct_7d > 0
    assert len(f.points) == 30
    assert all(p.lo <= p.yhat <= p.hi for p in f.points)


def test_downtrend_forecast_biases_signal_to_sell():
    down = _rows([2600 - i * 12 for i in range(30)])          # steady fall
    f = forecast_prices([(r.date, r.modal_price) for r in down], 30)
    assert f.change_pct_7d is not None and f.change_pct_7d < -3

    sig = compute_signal(down, forecast=f)
    assert sig is not None
    assert sig.forecast_bias == 1                              # falling -> sell now
    assert any("trending down" in r for r in sig.reasons)


def test_uptrend_forecast_biases_signal_to_wait():
    up = _rows([1500 + i * 10 for i in range(30)])
    f = forecast_prices([(r.date, r.modal_price) for r in up], 30)
    sig = compute_signal(up, forecast=f)
    assert sig is not None and sig.forecast_bias == -1         # rising -> wait
