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

from app.core.config import settings
from app.models.geo_cache import GeoCache
from app.services.geo import DISTRICT_CENTROIDS, nearest_state
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
                params={"name": key, "count": 5, "country": "IN", "language": "en"},
            )
            resp.raise_for_status()
            hits = resp.json().get("results") or []
            # `country=IN` is only a hint — Open-Meteo still returns same-named
            # places elsewhere (e.g. "Punjab" -> a village in Sindh, PK). Keep
            # only Indian hits; if none, fall through to the static fallback.
            h = next(
                (x for x in hits
                 if x.get("country_code") == "IN" or x.get("country") == "India"),
                None,
            )
            if h is not None:
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


def reverse_geocode(lat: float, lon: float, db: Session) -> dict:
    """lat/lon -> {state, district, display_name, latitude, longitude, source}.

    Uses the free keyless BigDataCloud reverse-geocoder, cached in ``geo_cache``
    under a rounded-coordinate key. Falls back to the nearest state centroid.
    """
    key = f"@rev:{round(lat, 3)},{round(lon, 3)}"
    cached = db.execute(select(GeoCache).where(GeoCache.query == key)).scalar_one_or_none()
    if cached is not None:
        return {
            "state": cached.admin1,
            "district": cached.admin2,
            "display_name": cached.display_name,
            "latitude": cached.latitude,
            "longitude": cached.longitude,
            "source": "cache",
        }

    state = ""
    district = ""
    display = ""
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                settings.reverse_geocode_url,
                params={"latitude": lat, "longitude": lon, "localityLanguage": "en"},
            )
            resp.raise_for_status()
            j = resp.json()
            # Only trust the result if it's actually in India.
            if (j.get("countryCode") or "").upper() not in ("IN", ""):
                j = {}
            state = j.get("principalSubdivision") or ""
            # BigDataCloud nests admin levels; the deepest one that isn't the
            # state or the country is usually the district.
            names = [
                a["name"]
                for a in j.get("localityInfo", {}).get("administrative", [])
                if a.get("name")
            ]
            district = next(
                (n for n in reversed(names) if n and n not in (state, "India")),
                j.get("city") or j.get("locality") or "",
            )
            display = ", ".join(x for x in (j.get("city") or j.get("locality"), district, state) if x)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Reverse geocode failed (%s); snapping to nearest state", exc)

    if not state:
        state = nearest_state(lat, lon)
        display = display or state
        src = "static"
    else:
        src = "bigdatacloud"

    db.add(
        GeoCache(
            query=key,
            latitude=lat,
            longitude=lon,
            display_name=display or state,
            admin1=state,
            admin2=district,
            admin3="",
        )
    )
    db.commit()
    return {
        "state": state,
        "district": district,
        "display_name": display or state,
        "latitude": lat,
        "longitude": lon,
        "source": src,
    }
