"""compute_signal() behaviour lock (D-08). Pure function — no ORM, rows are
SimpleNamespace stand-ins for PriceCache. signal.py is frozen this phase; these
tests pin its current output, including the null-volume "skipped" reason (D-07).
"""

from datetime import date, timedelta
from types import SimpleNamespace

from app.services.signal import compute_signal


def _rows(prices, volumes=None):
    start = date.today() - timedelta(days=len(prices) - 1)
    return [
        SimpleNamespace(
            date=start + timedelta(days=i),
            modal_price=p,
            arrival_volume=(volumes[i] if volumes else None),
        )
        for i, p in enumerate(prices)
    ]


def test_none_under_7_days():
    assert compute_signal(_rows([100, 101, 102, 103, 104, 105])) is None


def test_7_to_13_days_has_no_ma30_branch():
    sig = compute_signal(_rows([100] * 10))
    assert sig is not None
    assert sig.ma_30 is None
    assert any("30-day comparison" in r for r in sig.reasons)


def test_sell_now_on_strong_price():
    prices = [100] * 25 + [112, 113, 114, 115, 116, 117, 118]
    sig = compute_signal(_rows(prices))
    assert sig.recommendation == "sell_now"


def test_wait_on_depressed_price():
    prices = [100] * 25 + [88, 87, 86, 85, 84, 83, 82]
    sig = compute_signal(_rows(prices))
    assert sig.recommendation == "wait"


def test_hold_on_flat_price():
    sig = compute_signal(_rows([100] * 30))
    assert sig.recommendation == "hold"


def test_volume_reason_present_when_volumes_supplied():
    n = 20
    sig = compute_signal(_rows([100] * n, volumes=[100] * 13 + [130] * 7))
    assert any("Arrivals are up" in r for r in sig.reasons)


def test_volume_skipped_reason_when_absent():
    sig = compute_signal(_rows([100] * 20))
    assert any("Arrival-volume data isn't available" in r for r in sig.reasons)
