"""Location resolution (v1.2). Public. Turns the user's GPS fix or a typed place
name into a state + district + coordinates, and best-effort ensures we have
price data for that state.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services import locations as loc
from app.services.geo import STATE_CENTROIDS

router = APIRouter(prefix="/api/location", tags=["location"])


@router.get("/resolve")
def resolve(
    lat: float | None = Query(None),
    lon: float | None = Query(None),
    place: str | None = Query(None),
    ensure_prices: bool = Query(True),
    db: Session = Depends(get_db),
) -> dict:
    if (lat is None or lon is None) and not place:
        raise HTTPException(status_code=422, detail="Provide lat+lon or place")
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
