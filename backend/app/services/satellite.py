"""Optional satellite crop-health (NDVI) overlay (v1.12).

Google Earth Engine access is entirely optional: set ``GEE_PROJECT_ID``,
``GEE_SERVICE_ACCOUNT`` and ``GEE_CREDENTIALS_PATH`` (a downloaded service-
account JSON key) to enable it. Blank/missing/invalid credentials, or any
Earth Engine failure (network, quota, no imagery in the lookback window),
degrade to ``None`` — nothing here can block a request or the Decision Brief.

Source: ``MODIS/061/MOD13Q1``, a free 16-day, 250m, cloud-gap-filled NDVI
composite — chosen over raw Sentinel-2 because a single farmer's few-km plot
routinely has zero cloud-free Sentinel-2 passes in a given month during the
monsoon, while MODIS's compositing is built specifically to paper over that
gap. NDVI is informational context only — nothing here decides sell/wait.
"""

import logging
import os
from datetime import date, timedelta
from functools import lru_cache

from app.core.config import settings

logger = logging.getLogger(__name__)

_RADIUS_M = 3000  # ~3km buffer, comparable to one farmer's plot cluster
_LOOKBACK_DAYS = 90  # a few 16-day MODIS composites even allowing for gaps

# NDVI is -1..1; over farmland these are the commonly used crop-vigour cuts
# (bare soil/very sparse < 0.2, early growth or stress < 0.4, healthy < 0.6).
_HEALTH_BANDS = [(0.2, "poor"), (0.4, "fair"), (0.6, "good")]


def _resolve_credentials_path() -> str | None:
    """The configured path, or the same filename resolved against the repo
    root — the credential file conventionally sits next to backend/, not
    inside it, but the app's working directory is backend/ when it runs."""
    path = settings.gee_credentials_path
    if not path:
        return None
    if os.path.exists(path):
        return path
    repo_root_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", path)
    if os.path.exists(repo_root_path):
        return repo_root_path
    return None


def available() -> bool:
    return bool(
        settings.gee_project_id
        and settings.gee_service_account
        and _resolve_credentials_path()
    )


def _health_label(ndvi: float) -> str:
    for threshold, label in _HEALTH_BANDS:
        if ndvi < threshold:
            return label
    return "excellent"


@lru_cache(maxsize=1)
def _client():
    """Initialises the Earth Engine client once per process. Raises on any
    failure — callers must catch."""
    import ee

    creds = ee.ServiceAccountCredentials(
        settings.gee_service_account, _resolve_credentials_path()
    )
    ee.Initialize(creds, project=settings.gee_project_id)
    return ee


def get_ndvi(lat: float, lon: float) -> dict | None:
    """Mean NDVI over a ~3km buffer from the most recent MODIS 16-day
    composite in the lookback window. None if GEE isn't configured, or the
    call fails for any reason."""
    if not available():
        return None
    try:
        ee = _client()
        region = ee.Geometry.Point([lon, lat]).buffer(_RADIUS_M)
        since = (date.today() - timedelta(days=_LOOKBACK_DAYS)).isoformat()

        col = (
            ee.ImageCollection("MODIS/061/MOD13Q1")
            .filterBounds(region)
            .filterDate(since, date.today().isoformat())
            .sort("system:time_start", False)
        )
        if col.size().getInfo() == 0:
            return None

        latest = col.first()
        stats = (
            latest.select("NDVI")
            .multiply(0.0001)
            .reduceRegion(reducer=ee.Reducer.mean(), geometry=region, scale=250, maxPixels=1_000_000_000)
            .getInfo()
        )
        ndvi = stats.get("NDVI")
        if ndvi is None:
            return None
        as_of = ee.Date(latest.get("system:time_start")).format("YYYY-MM-dd").getInfo()
        return {
            "ndvi": round(float(ndvi), 3),
            "as_of": as_of,
            "health": _health_label(ndvi),
            "source": "MODIS/061/MOD13Q1",
        }
    except Exception as exc:  # noqa: BLE001 - satellite data must never block a request
        logger.warning("Satellite NDVI lookup failed (%s)", exc)
        return None
