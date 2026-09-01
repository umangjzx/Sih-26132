"""Road distance + drive time between two points via the public OSRM demo
server (free, fair-use). In-memory TTL cache keyed on rounded coordinates.

Falls back to straight-line (haversine) distance and a rough 40 km/h estimate
when OSRM is unreachable.
"""

import logging
import time

import httpx

from app.services.geo import haversine_km

logger = logging.getLogger(__name__)

OSRM_URL = "https://router.project-osrm.org/route/v1/driving"
_CACHE: dict[tuple, tuple[float, tuple[float, float]]] = {}
_TTL_SECONDS = 24 * 3600
_FALLBACK_KMPH = 40.0


def road_distance(
    origin: tuple[float, float], dest: tuple[float, float]
) -> dict:
    """Return ``{distance_km, duration_min, source}`` for driving origin -> dest."""
    key = (
        round(origin[0], 3),
        round(origin[1], 3),
        round(dest[0], 3),
        round(dest[1], 3),
    )
    now = time.time()
    hit = _CACHE.get(key)
    if hit is not None and now - hit[0] < _TTL_SECONDS:
        km, mins = hit[1]
        return {"distance_km": km, "duration_min": mins, "source": "cache"}

    straight = round(haversine_km(origin, dest), 1)

    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                f"{OSRM_URL}/{origin[1]},{origin[0]};{dest[1]},{dest[0]}",
                params={"overview": "false"},
            )
            resp.raise_for_status()
            data = resp.json()
            route = (data.get("routes") or [{}])[0]
            dist_m = route.get("distance")
            dur_s = route.get("duration")
            if dist_m is not None and dur_s is not None:
                km = round(dist_m / 1000.0, 1)
                mins = round(dur_s / 60.0, 0)
                _CACHE[key] = (now, (km, mins))
                return {"distance_km": km, "duration_min": mins, "source": "osrm"}
    except Exception as exc:  # noqa: BLE001
        logger.warning("OSRM routing failed (%s); using haversine estimate", exc)

    est_min = round(straight / _FALLBACK_KMPH * 60.0, 0)
    _CACHE[key] = (now, (straight, est_min))
    return {"distance_km": straight, "duration_min": est_min, "source": "estimate"}
