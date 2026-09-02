"""Demand endpoints: create, list own, browse nearby (farmer), express interest."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.demand import Demand
from app.models.lot import Lot
from app.schemas.demand import BrowseDemandOut, DemandCreate, DemandResponse
from app.schemas.lot import ExpressInterestResult

router = APIRouter(prefix="/api/demands", tags=["demands"])


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
    fields = body.model_dump()
    if not fields.get("delivery_district"):
        fields["delivery_district"] = current_user.district or ""
    if fields.get("latitude") is None or fields.get("longitude") is None:
        if fields["delivery_district"] and fields["delivery_district"] == (current_user.district or ""):
            fields["latitude"] = current_user.latitude
            fields["longitude"] = current_user.longitude
        elif fields["delivery_district"]:
            try:
                from app.services.geocode import geocode

                geo = geocode(fields["delivery_district"], db)
                if geo:
                    fields["latitude"] = geo["latitude"]
                    fields["longitude"] = geo["longitude"]
            except Exception:  # noqa: BLE001 — geocoding never blocks demand creation
                pass

    demand = Demand(buyer_id=current_user.id, **fields)
    db.add(demand)
    db.commit()
    db.refresh(demand)

    from app.services.matching import run_matching
    run_matching(db)

    return DemandResponse.model_validate(demand)


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
