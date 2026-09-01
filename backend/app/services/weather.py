"""Weather intelligence for the sell/wait decision.

- 7-day forecast (precipitation, max temp, wind) from Open-Meteo (free, no key).
- Recent rainfall vs the long-term normal from NASA POWER (free, no key).
- A plain-language note + a signed ``sell_bias`` in {-1, 0, +1} the price signal
  folds in: heavy rain soon -> +1 (transport/quality risk favours selling now).

All network calls degrade to an empty/neutral result on failure — the app never
blocks on weather.
"""

import datetime as dt
import logging
import time

import httpx

logger = logging.getLogger(__name__)

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"

_CACHE: dict[tuple, tuple[float, dict]] = {}
_TTL_SECONDS = 3 * 3600

HEAVY_RAIN_MM = 20.0          # 3-day total that flags a sell bias
WET_SPELL_MM = 10.0          # per-day threshold used for "wet day" counting


def _cached(key: tuple):
    hit = _CACHE.get(key)
    if hit and time.time() - hit[0] < _TTL_SECONDS:
        return hit[1]
    return None


def _store(key: tuple, value: dict) -> dict:
    _CACHE[key] = (time.time(), value)
    return value


def get_forecast(lat: float, lon: float) -> dict:
    """7-day daily forecast + a derived sell bias and a plain-language note."""
    key = ("fc", round(lat, 2), round(lon, 2))
    cached = _cached(key)
    if cached is not None:
        return cached

    empty = {
        "days": [],
        "next3_rain_mm": None,
        "sell_bias": 0,
        "note": "Weather forecast is unavailable right now.",
        "source": "unavailable",
    }
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                FORECAST_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "daily": "precipitation_sum,temperature_2m_max,wind_speed_10m_max,precipitation_probability_max",
                    "forecast_days": 7,
                    "timezone": "Asia/Kolkata",
                },
            )
            resp.raise_for_status()
            d = resp.json().get("daily", {})
    except Exception as exc:  # noqa: BLE001
        logger.warning("Open-Meteo forecast failed (%s)", exc)
        return _store(key, empty)

    times = d.get("time", [])
    if not times:
        return _store(key, empty)

    precip = d.get("precipitation_sum", [])
    tmax = d.get("temperature_2m_max", [])
    wind = d.get("wind_speed_10m_max", [])
    pprob = d.get("precipitation_probability_max", [])

    days = []
    for i, day in enumerate(times):
        days.append(
            {
                "date": day,
                "precip_mm": round(float(precip[i]), 1) if i < len(precip) and precip[i] is not None else 0.0,
                "temp_max_c": round(float(tmax[i]), 1) if i < len(tmax) and tmax[i] is not None else None,
                "wind_kmh": round(float(wind[i]), 1) if i < len(wind) and wind[i] is not None else None,
                "rain_prob": int(pprob[i]) if i < len(pprob) and pprob[i] is not None else None,
            }
        )

    next3 = round(sum(x["precip_mm"] for x in days[:3]), 1)
    wet_days = sum(1 for x in days[:5] if x["precip_mm"] >= WET_SPELL_MM)

    if next3 >= HEAVY_RAIN_MM:
        bias = 1
        note = (
            f"Heavy rain expected over the next 3 days ({next3:.0f} mm total) — "
            "moving produce out now avoids transport delays and quality loss."
        )
    elif wet_days >= 3:
        bias = 1
        note = (
            f"A wet spell is likely ({wet_days} rainy days in the next 5) — "
            "consider selling before roads and drying conditions worsen."
        )
    elif next3 <= 2.0:
        bias = 0
        note = "Dry weather ahead — no weather pressure on the sell/wait decision."
    else:
        bias = 0
        note = f"Some rain expected ({next3:.0f} mm over 3 days) but nothing severe."

    return _store(
        key,
        {"days": days, "next3_rain_mm": next3, "sell_bias": bias, "note": note, "source": "open-meteo"},
    )


def get_rain_anomaly(lat: float, lon: float) -> dict:
    """Last-30-day rainfall vs the same 30-day window averaged over 2015-2024,
    from NASA POWER. Returns ``{recent_mm, normal_mm, pct_of_normal, note}``.
    """
    key = ("ra", round(lat, 2), round(lon, 2))
    cached = _cached(key)
    if cached is not None:
        return cached

    today = dt.date.today()
    start = today - dt.timedelta(days=31)
    empty = {"recent_mm": None, "normal_mm": None, "pct_of_normal": None,
             "note": "Rainfall comparison is unavailable right now.", "source": "unavailable"}

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                POWER_URL,
                params={
                    "parameters": "PRECTOTCORR",
                    "community": "AG",
                    "latitude": lat,
                    "longitude": lon,
                    "start": start.strftime("%Y%m%d"),
                    "end": today.strftime("%Y%m%d"),
                    "format": "JSON",
                },
            )
            resp.raise_for_status()
            recent_series = (
                resp.json().get("properties", {}).get("parameter", {}).get("PRECTOTCORR", {})
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("NASA POWER failed (%s)", exc)
        return _store(key, empty)

    vals = [v for v in recent_series.values() if isinstance(v, (int, float)) and v >= 0]
    if not vals:
        return _store(key, empty)
    recent_mm = round(sum(vals), 1)

    # climatology: same calendar window across recent years
    normals: list[float] = []
    try:
        with httpx.Client(timeout=15.0) as client:
            for yr in range(today.year - 10, today.year):
                s = start.replace(year=yr if start.month <= today.month else yr)
                e = today.replace(year=yr)
                r = client.get(
                    POWER_URL,
                    params={
                        "parameters": "PRECTOTCORR",
                        "community": "AG",
                        "latitude": lat,
                        "longitude": lon,
                        "start": s.strftime("%Y%m%d"),
                        "end": e.strftime("%Y%m%d"),
                        "format": "JSON",
                    },
                )
                if r.status_code != 200:
                    continue
                series = r.json().get("properties", {}).get("parameter", {}).get("PRECTOTCORR", {})
                yr_vals = [v for v in series.values() if isinstance(v, (int, float)) and v >= 0]
                if yr_vals:
                    normals.append(sum(yr_vals))
    except Exception as exc:  # noqa: BLE001
        logger.warning("NASA POWER climatology partial (%s)", exc)

    if not normals:
        return _store(
            key,
            {"recent_mm": recent_mm, "normal_mm": None, "pct_of_normal": None,
             "note": f"Last 30 days recorded {recent_mm:.0f} mm of rain.", "source": "nasa-power"},
        )

    normal_mm = round(sum(normals) / len(normals), 1)
    pct = round(recent_mm / normal_mm * 100.0, 0) if normal_mm > 0 else None
    if pct is not None and pct >= 130:
        note = f"Rainfall is well above normal ({pct:.0f}% of the 10-year average) — expect wet-market conditions and possible quality discounts."
    elif pct is not None and pct <= 70:
        note = f"Rainfall is below normal ({pct:.0f}% of the 10-year average) — drier handling, but watch for supply tightening later in the season."
    else:
        note = f"Rainfall is close to normal ({pct:.0f}% of the 10-year average)." if pct is not None else f"Last 30 days: {recent_mm:.0f} mm."

    return _store(
        key,
        {"recent_mm": recent_mm, "normal_mm": normal_mm, "pct_of_normal": pct, "note": note, "source": "nasa-power"},
    )
