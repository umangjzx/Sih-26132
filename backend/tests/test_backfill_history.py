"""Lazy per-series history: real AGMARKNET archive first, synthetic fill for gaps.

`backfill_series` is what makes trend charts / the sell-wait signal work when the
live feed only carries the latest day.
"""

from datetime import date, timedelta

from app.models.price_cache import PriceCache
from app.services import ingestion


def _seed_today(db, crop="Onion", market="Pune", modal=2000.0):
    db.add(PriceCache(crop=crop, variety="Local", market=market, district="Pune",
                      state="Maharashtra", date=date.today(),
                      min_price=modal - 100, max_price=modal + 100,
                      modal_price=modal, arrival_volume=None))
    db.commit()


def _archive_rows(crop, market, n, start_modal=1800):
    """Fake archive response rows (capitalised field names, dd/mm/yyyy dates)."""
    out = []
    for i in range(n):
        d = date.today() - timedelta(days=i + 1)
        out.append({
            "State": "Maharashtra", "District": "Pune", "Market": market,
            "Commodity": crop, "Variety": "Local", "Grade": "FAQ",
            "Arrival_Date": d.strftime("%d/%m/%Y"),
            "Min_Price": start_modal - 50, "Max_Price": start_modal + 50,
            "Modal_Price": start_modal + (i % 7) * 10,
        })
    return out


def test_backfill_uses_real_archive_history(db, monkeypatch):
    _seed_today(db)
    captured = {}

    def fake_history(api_key, state, commodity, market, *, days=120, timeout=12.0):
        captured["args"] = (state, commodity, market)
        lowered = [{k.lower(): v for k, v in r.items()}
                   for r in _archive_rows(commodity, market, 40)]
        return ingestion.normalize_rows(lowered)

    monkeypatch.setattr(ingestion.settings, "data_gov_in_api_key", "x")
    monkeypatch.setattr(ingestion, "fetch_history", fake_history)

    n = ingestion.backfill_series(db, "Onion", "Pune")
    assert n >= 40  # 40 real archive days + synthetic fill for the rest of the window
    assert captured["args"] == ("Maharashtra", "Onion", "Pune")

    days = db.query(PriceCache.date).filter(
        PriceCache.crop == "Onion", PriceCache.market == "Pune"
    ).distinct().count()
    assert days >= ingestion.BACKFILL_MIN_REAL_DAYS
    # today's real anchor is still the latest point, untouched
    latest = db.query(PriceCache).filter(
        PriceCache.crop == "Onion", PriceCache.market == "Pune"
    ).order_by(PriceCache.date.desc()).first()
    assert latest.date == date.today() and latest.modal_price == 2000.0


def test_backfill_synthesises_when_archive_empty(db, monkeypatch):
    _seed_today(db, crop="Tomato", market="Nashik", modal=1400.0)
    monkeypatch.setattr(ingestion.settings, "data_gov_in_api_key", "x")
    monkeypatch.setattr(ingestion, "fetch_history", lambda *a, **k: [])

    n = ingestion.backfill_series(db, "Tomato", "Nashik")
    assert n > 0
    rows = db.query(PriceCache).filter(
        PriceCache.crop == "Tomato", PriceCache.market == "Nashik"
    ).order_by(PriceCache.date).all()
    assert (rows[-1].date - rows[0].date).days >= ingestion.BACKFILL_DAYS - 2
    assert rows[-1].modal_price == 1400.0  # anchor preserved


def test_backfill_noop_when_series_already_deep(db, monkeypatch):
    for i in range(30):
        d = date.today() - timedelta(days=i)
        db.add(PriceCache(crop="Wheat", variety="", market="Akola", district="Akola",
                          state="Maharashtra", date=d, min_price=2400, max_price=2500,
                          modal_price=2450, arrival_volume=None))
    db.commit()
    called = {"n": 0}
    monkeypatch.setattr(ingestion, "fetch_history",
                        lambda *a, **k: called.__setitem__("n", called["n"] + 1) or [])
    assert ingestion.backfill_series(db, "Wheat", "Akola") == 0
    assert called["n"] == 0  # short-circuits before any network call
