"""Public-holiday awareness — APMC mandis are usually closed on national
holidays. Data from the free Nager.Date API (no key), cached per year, with a
small hard-coded fallback set for the common India-wide holidays.
"""

import datetime as dt
import logging
import time

import httpx

logger = logging.getLogger(__name__)

NAGER_URL = "https://date.nager.at/api/v3/PublicHolidays"
_CACHE: dict[int, tuple[float, list[dict]]] = {}
_TTL_SECONDS = 7 * 24 * 3600

_FALLBACK: dict[int, list[tuple[str, str]]] = {
    2026: [
        ("2026-01-26", "Republic Day"),
        ("2026-03-04", "Holi"),
        ("2026-04-14", "Ambedkar Jayanti"),
        ("2026-05-01", "Maharashtra Day"),
        ("2026-08-15", "Independence Day"),
        ("2026-10-02", "Gandhi Jayanti"),
        ("2026-10-20", "Dussehra"),
        ("2026-11-08", "Diwali"),
    ],
}


def _holidays_for_year(year: int) -> list[dict]:
    hit = _CACHE.get(year)
    if hit and time.time() - hit[0] < _TTL_SECONDS:
        return hit[1]

    result: list[dict] = []
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(f"{NAGER_URL}/{year}/IN")
            resp.raise_for_status()
            for h in resp.json():
                result.append({"date": h["date"], "name": h.get("localName") or h.get("name", "Holiday")})
    except Exception as exc:  # noqa: BLE001
        logger.warning("Nager.Date failed for %s (%s); using fallback", year, exc)
        result = [{"date": d, "name": n} for d, n in _FALLBACK.get(year, [])]

    _CACHE[year] = (time.time(), result)
    return result


def upcoming_market_holidays(from_date: dt.date | None = None, days: int = 30) -> list[dict]:
    """Holidays in the next ``days`` days (APMC markets likely closed)."""
    start = from_date or dt.date.today()
    end = start + dt.timedelta(days=days)
    out: list[dict] = []
    for year in {start.year, end.year}:
        for h in _holidays_for_year(year):
            try:
                d = dt.date.fromisoformat(h["date"])
            except ValueError:
                continue
            if start <= d <= end:
                out.append({"date": h["date"], "name": h["name"], "in_days": (d - start).days})
    out.sort(key=lambda x: x["date"])
    return out
