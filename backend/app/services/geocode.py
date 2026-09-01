"""Village / town geocoding via the Open-Meteo geocoding API (free, no key,
fair-use). Every resolved name is persisted in ``geo_cache`` so we never query
the same string twice.

Falls back to the static Maharashtra district-centroid table when the API is
unreachable or returns nothing.
"""

import logging

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.geo_cache import GeoCache
from app.services.geo import DISTRICT_CENTROIDS
from app.services.market_towns import MARKET_COORDS

logger = logging.getLogger(__name__)

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"


def _fallback(name: str) -> tuple[float, float, str] | None:
    key = name.strip()
    if key in MARKET_COORDS:
        lat, lon = MARKET_COORDS[key]
        return lat, lon, key
    # try the first comma-separated token against district centroids
    for token in (key, *[p.strip() for p in key.split(",")]):
        if token in DISTRICT_CENTROIDS:
            lat, lon = DISTRICT_CENTROIDS[token]
            return lat, lon, token
    return None


def geocode(name: str, db: Session) -> dict | None:
    """Return ``{latitude, longitude, display_name, admin1, admin2, admin3, source}``
    for a place name, or ``None`` if it cannot be resolved. Results are cached in
    ``geo_cache``.
    """
    key = " ".join(name.strip().split())[:200]
    if not key:
        return None

    cached = db.execute(select(GeoCache).where(GeoCache.query == key)).scalar_one_or_none()
    if cached is not None:
        return {
            "latitude": cached.latitude,
            "longitude": cached.longitude,
            "display_name": cached.display_name,
            "admin1": cached.admin1,
            "admin2": cached.admin2,
            "admin3": cached.admin3,
            "source": "cache",
        }

    # Known Maharashtra market towns / districts resolve locally — no network call.
    fb0 = _fallback(key)
    if fb0 is not None:
        lat, lon, disp = fb0
        result = {"latitude": lat, "longitude": lon, "display_name": disp,
                  "admin1": "Maharashtra", "admin2": "", "admin3": "", "source": "static"}
        db.add(GeoCache(query=key, latitude=lat, longitude=lon, display_name=disp,
                        admin1="Maharashtra", admin2="", admin3=""))
        db.commit()
        return result

    result: dict | None = None
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                GEOCODE_URL,
                params={"name": key, "count": 1, "country": "IN", "language": "en"},
            )
            resp.raise_for_status()
            hits = resp.json().get("results") or []
            if hits:
                h = hits[0]
                result = {
                    "latitude": float(h["latitude"]),
                    "longitude": float(h["longitude"]),
                    "display_name": h.get("name", key),
                    "admin1": h.get("admin1", "") or "",
                    "admin2": h.get("admin2", "") or "",
                    "admin3": h.get("admin3", "") or "",
                    "source": "open-meteo",
                }
    except Exception as exc:  # noqa: BLE001 - any failure falls back
        logger.warning("Geocoding '%s' failed (%s); using static fallback", key, exc)

    if result is None:
        fb = _fallback(key)
        if fb is None:
            return None
        lat, lon, disp = fb
        result = {
            "latitude": lat,
            "longitude": lon,
            "display_name": disp,
            "admin1": "Maharashtra",
            "admin2": "",
            "admin3": "",
            "source": "static",
        }

    db.add(
        GeoCache(
            query=key,
            latitude=result["latitude"],
            longitude=result["longitude"],
            display_name=result["display_name"],
            admin1=result["admin1"],
            admin2=result["admin2"],
            admin3=result["admin3"],
        )
    )
    db.commit()
    return result
