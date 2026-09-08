"""Location resolution + on-demand price ingestion for a user's state (v1.2).

The scheduled job pulls ``settings.ingest_states`` (Maharashtra by default). When
a user resolves a location in a state we have no cached prices for, we pull that
one state on the spot (best-effort, rate-limited) so the rest of India works too.
"""

import logging
import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.price_cache import PriceCache
from app.services import ingestion
from app.services.fixtures import generate_state_fixture_rows
from app.services.geo import STATE_CENTROIDS
from app.services.geocode import geocode, reverse_geocode

logger = logging.getLogger(__name__)

# state -> last on-demand ingest attempt (epoch); one attempt per state per hour.
_LAST_TRY: dict[str, float] = {}
_MIN_INTERVAL = 3600.0


def _norm_state(name: str) -> str:
    n = (name or "").strip()
    for k in STATE_CENTROIDS:
        if k.lower() == n.lower():
            return k
    return n


def resolve_location(
    db: Session,
    *,
    lat: float | None = None,
    lon: float | None = None,
    place: str | None = None,
) -> dict:
    """Return {state, district, display_name, latitude, longitude, source}."""
    if lat is not None and lon is not None:
        r = reverse_geocode(lat, lon, db)
        r["state"] = _norm_state(r.get("state", ""))
        return r
    if place:
        # A bare Indian state/UT name (e.g. picked from the /states dropdown)
        # resolves to its centroid directly — never geocoded, since the free
        # geocoder happily returns same-named villages in other countries.
        norm = _norm_state(place)
        if norm in STATE_CENTROIDS:
            clat, clon = STATE_CENTROIDS[norm]
            return {"state": norm, "district": "", "display_name": norm,
                    "latitude": clat, "longitude": clon, "source": "state"}
        g = geocode(place, db)
        if g is None:
            return {"state": "", "district": "", "display_name": place,
                    "latitude": None, "longitude": None, "source": "unresolved"}
        return {
            "state": _norm_state(g.get("admin1", "")),
            "district": g.get("admin2", ""),
            "display_name": g.get("display_name", place),
            "latitude": g["latitude"],
            "longitude": g["longitude"],
            "source": g.get("source", "geocode"),
        }
    raise ValueError("resolve_location needs lat+lon or place")


def state_has_prices(db: Session, state: str) -> bool:
    if not state:
        return False
    return db.execute(
        select(PriceCache.id).where(PriceCache.state == state).limit(1)
    ).first() is not None


def ensure_state_ingested(db: Session, state: str) -> dict:
    """If we have no cached prices for ``state``, pull *just that state* from the
    live AGMARKNET feed. If that comes back empty, fall back to
    ``generate_state_fixture_rows`` — a hand-curated market/crop mix for major
    producing states, or a generic national mix for any other real state/UT —
    so no state resolvable via ``STATE_CENTROIDS`` is permanently stranded
    with zero prices.

    Returns {'ingested': bool, 'reason': str, 'rows_upserted': int}.
    """
    state = _norm_state(state)
    if not state:
        return {"ingested": False, "reason": "no state", "rows_upserted": 0}
    if state_has_prices(db, state):
        return {"ingested": False, "reason": "already cached", "rows_upserted": 0}
    if not settings.data_gov_in_api_key:
        return {"ingested": False, "reason": "no api key", "rows_upserted": 0}
    now = time.time()
    if now - _LAST_TRY.get(state, 0.0) < _MIN_INTERVAL:
        return {"ingested": False, "reason": "rate-limited", "rows_upserted": 0}
    _LAST_TRY[state] = now
    rows: list[dict] = []
    reason = "no-live-data"
    try:
        # Best-effort, bounded: the upstream API is slow, and this runs
        # inline on a user action (GET /api/location/resolve), not the
        # scheduled/off-request ingestion job — 4 pages x 8s was a ~32s
        # worst case (every page stalling to its own timeout) blocking one
        # request thread on a cold path (a genuinely new state, or a judge
        # demoing from an unusual region). Fail fast, then fall back to a
        # synthetic demo series either way.
        raw = ingestion.fetch_agmarknet_rows(
            settings.data_gov_in_api_key, [state], timeout=5.0, max_pages=2
        )
        rows = [
            r for r in ingestion.normalize_rows(raw)
            if (r.get("state") or "").strip().lower() == state.lower()
        ]
        if rows:
            reason = "live"
    except Exception as exc:  # noqa: BLE001
        logger.warning("On-demand live ingestion for %s failed (%s)", state, exc)

    if not rows:
        # Offline / no-key fallback: plausible synthetic data so the location
        # switch always lands on something.
        rows = generate_state_fixture_rows(state)
        if rows:
            reason = "demo-fixture"

    n = ingestion.upsert_price_rows(db, rows) if rows else 0
    return {"ingested": n > 0, "reason": reason, "rows_upserted": n}
