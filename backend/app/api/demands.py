"""Demand endpoints: create, edit, withdraw, list own, browse nearby (farmer),
express interest."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import ratelimit
from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.schemas.demand import BrowseDemandOut, DemandCreate, DemandResponse, DemandUpdate
from app.schemas.lot import ExpressInterestResult

router = APIRouter(prefix="/api/demands", tags=["demands"])
logger = logging.getLogger(__name__)

_WRITE_LIMIT, _WRITE_WINDOW_S = 40, 600
_INTEREST_LIMIT, _INTEREST_WINDOW_S = 30, 300


def _rematch(db: Session, demand: Demand) -> None:
    try:
        from app.services.matching import match_demand

        match_demand(db, demand)
    except Exception:  # noqa: BLE001
        logger.exception("match_demand failed after demand write")


def _geocode_district(district: str, db: Session) -> tuple[float, float] | None:
    try:
        from app.services.geocode import geocode

        geo = geocode(district, db)
        if geo:
            return geo["latitude"], geo["longitude"]
    except Exception:  # noqa: BLE001
        logger.debug("demand geocode failed for %r", district, exc_info=True)
    return None


@router.post("/", response_model=DemandResponse, status_code=status.HTTP_201_CREATED)
def create_demand(
    body: DemandCreate,
    current_user: CurrentUser,
    _role: Annotated[None, require_role("buyer")] = None,
    db: Session = Depends(get_db),
) -> DemandResponse:
    """Create a new demand for the authenticated buyer, then trigger match scoring.

    Delivery location defaults to the buyer's own profile location when the
    request doesn't carry one, so distance-aware matching has something to work
    with. If the buyer supplied a district but no coordinates, geocode it.
    """
    if not ratelimit.check(f"demand_write:{current_user.id}",
                           limit=_WRITE_LIMIT, window_s=_WRITE_WINDOW_S):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Too many listing changes in a short time. Please slow down.")

    fields = body.model_dump()
    if not fields.get("delivery_district"):
        fields["delivery_district"] = current_user.district or ""
    if fields.get("latitude") is None or fields.get("longitude") is None:
        if fields["delivery_district"] and fields["delivery_district"] == (current_user.district or ""):
            fields["latitude"] = current_user.latitude
            fields["longitude"] = current_user.longitude
        elif fields["delivery_district"]:
            c = _geocode_district(fields["delivery_district"], db)
            if c:
                fields["latitude"], fields["longitude"] = c

    demand = Demand(buyer_id=current_user.id, **fields)
    db.add(demand)
    db.commit()
    db.refresh(demand)
    _rematch(db, demand)
    return DemandResponse.model_validate(demand)


@router.patch("/{demand_id}", response_model=DemandResponse)
def update_demand(
    demand_id: int,
    body: DemandUpdate,
    current_user: CurrentUser,
    _role: Annotated[None, require_role("buyer")] = None,
    db: Session = Depends(get_db),
) -> DemandResponse:
    """Edit one of your own demands while it is still open."""
    if not ratelimit.check(f"demand_write:{current_user.id}",
                           limit=_WRITE_LIMIT, window_s=_WRITE_WINDOW_S):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Too many listing changes in a short time. Please slow down.")

    demand = db.get(Demand, demand_id)
    if demand is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demand not found")
    if demand.buyer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your demand")
    if demand.status != "open":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "This demand is already in a deal and can't be edited.")

    data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    # cross-field guard against the stored values
    lo = data.get("price_band_min", demand.price_band_min)
    hi = data.get("price_band_max", demand.price_band_max)
    if hi < lo:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "price_band_max must be >= price_band_min")

    dist_changed = "delivery_district" in data and data["delivery_district"] != demand.delivery_district
    for field, value in data.items():
        setattr(demand, field, value)
    if dist_changed and ("latitude" not in data or "longitude" not in data):
        c = _geocode_district(demand.delivery_district or "", db)
        if c:
            demand.latitude, demand.longitude = c

    db.commit()
    db.refresh(demand)
    _rematch(db, demand)
    return DemandResponse.model_validate(demand)


@router.delete("/{demand_id}", status_code=status.HTTP_200_OK)
def withdraw_demand(
    demand_id: int,
    current_user: CurrentUser,
    _role: Annotated[None, require_role("buyer")] = None,
    db: Session = Depends(get_db),
) -> dict:
    """Withdraw one of your own open demands (soft delete → status 'closed')."""
    demand = db.get(Demand, demand_id)
    if demand is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demand not found")
    if demand.buyer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your demand")
    if demand.status != "open":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "This demand is in a deal and can't be withdrawn.")
    demand.status = "closed"
    for m in db.execute(
        select(Match).where(Match.demand_id == demand.id, Match.status.in_(("proposed", "offered")))
    ).scalars().all():
        m.status = "rejected"
    db.commit()
    return {"detail": "Demand withdrawn", "demand_id": demand.id}


@router.get("/mine", response_model=list[DemandResponse])
def list_my_demands(
    current_user: CurrentUser,
    _role: Annotated[None, require_role("buyer")] = None,
    db: Session = Depends(get_db),
) -> list[DemandResponse]:
    """Return all demands belonging to the authenticated buyer, newest first."""
    rows = db.execute(
        select(Demand).where(Demand.buyer_id == current_user.id).order_by(Demand.id.desc())
    ).scalars().all()
    return [DemandResponse.model_validate(r) for r in rows]


@router.get("/browse", response_model=list[BrowseDemandOut])
def browse_demands(
    current_user: CurrentUser,
    crop: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius_km: float | None = Query(None, gt=0, le=3000),
    limit: int = Query(60, ge=1, le=200),
    _role: Annotated[None, require_role("farmer")] = None,
    db: Session = Depends(get_db),
) -> list[BrowseDemandOut]:
    """Open buyer demands near the farmer (their profile location, or lat/lon)."""
    from app.services.discovery import browse_demands as _browse

    return [
        BrowseDemandOut(**r)
        for r in _browse(db, current_user, crop=crop, lat=lat, lon=lon,
                         radius_km=radius_km, limit=limit)
    ]


@router.post("/{demand_id}/express-interest", response_model=ExpressInterestResult)
def express_interest_in_demand(
    demand_id: int,
    current_user: CurrentUser,
    _role: Annotated[None, require_role("farmer")] = None,
    db: Session = Depends(get_db),
) -> ExpressInterestResult:
    """Try to open a match between this demand and one of the farmer's open lots
    for the same crop. 409 if the farmer has no such lot."""
    if not ratelimit.check(
        f"interest:{current_user.id}", limit=_INTEREST_LIMIT, window_s=_INTEREST_WINDOW_S
    ):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "You're expressing interest very quickly — please slow down a moment.",
        )
    demand = db.get(Demand, demand_id)
    if demand is None or demand.status != "open":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demand not found or not open")

    lots = db.execute(
        select(Lot).where(
            Lot.farmer_id == current_user.id,
            Lot.status == "open",
            Lot.crop.ilike(demand.crop),
        )
    ).scalars().all()
    if not lots:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"List an open lot of {demand.crop} first, then express interest.",
        )

    from app.services.matching import try_pair

    best: dict | None = None
    for lot in lots:
        r = try_pair(db, lot, demand)
        if r.get("matched"):
            return ExpressInterestResult(**r)
        if best is None or (r.get("score") or -1) > (best.get("score") or -1):
            best = r
    return ExpressInterestResult(**(best or {"matched": False}))
