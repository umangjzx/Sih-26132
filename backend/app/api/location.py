"""Location resolution (v1.2). Public. Turns the user's GPS fix or a typed place
name into a state + district + coordinates, and best-effort ensures we have
price data for that state.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core import ratelimit
from app.core.database import get_db
from app.services import locations as loc
from app.services.geo import STATE_CENTROIDS

router = APIRouter(prefix="/api/location", tags=["location"])

# public, and a cache miss makes a live geocoder call + a geo_cache insert —
# a script feeding unique strings would hammer the upstream API.
_RESOLVE_LIMIT, _RESOLVE_WINDOW_S = 20, 60


@router.get("/resolve")
def resolve(
    request: Request,
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    place: str | None = Query(None, max_length=120),
    ensure_prices: bool = Query(True),
    db: Session = Depends(get_db),
) -> dict:
    if (lat is None or lon is None) and not (place and place.strip()):
        raise HTTPException(status_code=422, detail="Provide lat+lon or place")
    ip = request.client.host if request.client else "unknown"
    if not ratelimit.check(f"loc_resolve:{ip}", limit=_RESOLVE_LIMIT, window_s=_RESOLVE_WINDOW_S):
        raise HTTPException(status_code=429, detail="Too many location lookups — please slow down.")
    resolved = loc.resolve_location(db, lat=lat, lon=lon, place=place)
    resolved["has_prices"] = loc.state_has_prices(db, resolved.get("state", ""))
    if ensure_prices and resolved.get("state") and not resolved["has_prices"]:
        ing = loc.ensure_state_ingested(db, resolved["state"])
        resolved["ingest_attempt"] = ing
        resolved["has_prices"] = loc.state_has_prices(db, resolved["state"])
    return resolved


@router.get("/states")
def states() -> list[str]:
    return sorted(STATE_CENTROIDS)


@router.get("/districts")
def districts(state: str, db: Session = Depends(get_db)) -> list[str]:
    """Districts known for a state — from the price feed plus the storage/FPO
    directory, so the directory page has a real picker outside Maharashtra."""
    from sqlalchemy import distinct, select

    from app.models.price_cache import PriceCache
    from app.services import reference as ref

    st = loc._norm_state(state)
    seen: set[str] = set()
    for (d,) in db.execute(
        select(distinct(PriceCache.district)).where(
            PriceCache.state == st, PriceCache.district != ""
        )
    ).all():
        if d:
            seen.add(d.strip())
    for row in (*ref.COLD_STORAGE, *ref.FPOS):
        if (row.get("state") or "").strip().lower() == st.lower() and row.get("district"):
            seen.add(row["district"].strip())
    return sorted(seen)
