"""Lot endpoints: create, edit, withdraw, list own, browse nearby (buyer),
express interest, get by id."""

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
from app.schemas.lot import (
    BrowseLotOut,
    ExpressInterestResult,
    LotCreate,
    LotResponse,
    LotUpdate,
)

router = APIRouter(prefix="/api/lots", tags=["lots"])
logger = logging.getLogger(__name__)

_CREATE_LIMIT, _CREATE_WINDOW_S = 40, 600  # 40 create/edit ops / 10 min per user


def _geocode_into(lot: Lot, location: str, db: Session) -> None:
    """Best-effort village-level geocoding for weather / road-distance features.
    Never blocks the write."""
    try:
        from app.services.geocode import geocode

        geo = geocode(location, db)
        if geo:
            lot.latitude = geo["latitude"]
            lot.longitude = geo["longitude"]
    except Exception:  # noqa: BLE001
        logger.debug("lot geocode failed for %r", location, exc_info=True)


def _rematch(db: Session, lot: Lot) -> None:
    """Incrementally re-score just this lot; never let a matcher error fail the
    write that already committed."""
    try:
        from app.services.matching import match_lot

        match_lot(db, lot)
    except Exception:  # noqa: BLE001
        logger.exception("match_lot failed after lot write")


@router.post("/", response_model=LotResponse, status_code=status.HTTP_201_CREATED)
def create_lot(
    body: LotCreate,
    current_user: CurrentUser,
    _role: Annotated[None, require_role("farmer")] = None,
    db: Session = Depends(get_db),
) -> LotResponse:
    """Create a new lot for the authenticated farmer, geocode its location, then
    trigger match scoring."""
    if not ratelimit.check(f"lot_write:{current_user.id}",
                           limit=_CREATE_LIMIT, window_s=_CREATE_WINDOW_S):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Too many listing changes in a short time. Please slow down.")

    lot = Lot(farmer_id=current_user.id, **body.model_dump())
    _geocode_into(lot, body.location, db)

    db.add(lot)
    db.commit()
    db.refresh(lot)
    _rematch(db, lot)
    return LotResponse.model_validate(lot)


@router.patch("/{lot_id}", response_model=LotResponse)
def update_lot(
    lot_id: int,
    body: LotUpdate,
    current_user: CurrentUser,
    _role: Annotated[None, require_role("farmer")] = None,
    db: Session = Depends(get_db),
) -> LotResponse:
    """Edit one of your own lots while it is still open. Re-geocodes and
    re-runs matching if the location changed."""
    if not ratelimit.check(f"lot_write:{current_user.id}",
                           limit=_CREATE_LIMIT, window_s=_CREATE_WINDOW_S):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Too many listing changes in a short time. Please slow down.")

    lot = db.get(Lot, lot_id)
    if lot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lot not found")
    if lot.farmer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your lot")
    if lot.status != "open":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "This lot is already in a deal and can't be edited.")

    data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    loc_changed = "location" in data and data["location"] != lot.location
    for field, value in data.items():
        setattr(lot, field, value)
    if loc_changed:
        _geocode_into(lot, lot.location, db)

    db.commit()
    db.refresh(lot)
    _rematch(db, lot)
    return LotResponse.model_validate(lot)


@router.delete("/{lot_id}", status_code=status.HTTP_200_OK)
def withdraw_lot(
    lot_id: int,
    current_user: CurrentUser,
    _role: Annotated[None, require_role("farmer")] = None,
    db: Session = Depends(get_db),
) -> dict:
    """Withdraw one of your own open lots (soft delete → status 'closed')."""
    lot = db.get(Lot, lot_id)
    if lot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lot not found")
    if lot.farmer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your lot")
    if lot.status != "open":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "This lot is in a deal and can't be withdrawn.")
    lot.status = "closed"
    # drop its still-open matches so they don't linger on buyers' boards
    for m in db.execute(
        select(Match).where(Match.lot_id == lot.id, Match.status.in_(("proposed", "offered")))
    ).scalars().all():
        m.status = "rejected"
    db.commit()
    return {"detail": "Lot withdrawn", "lot_id": lot.id}


@router.get("/mine", response_model=list[LotResponse])
def list_my_lots(
    current_user: CurrentUser,
    _role: Annotated[None, require_role("farmer")] = None,
    db: Session = Depends(get_db),
) -> list[LotResponse]:
    """Return all lots belonging to the authenticated farmer, newest first."""
    rows = db.execute(
        select(Lot).where(Lot.farmer_id == current_user.id).order_by(Lot.id.desc())
    ).scalars().all()
    return [LotResponse.model_validate(r) for r in rows]


@router.get("/browse", response_model=list[BrowseLotOut])
def browse_lots(
    current_user: CurrentUser,
    crop: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius_km: float | None = Query(None, gt=0, le=3000),
    limit: int = Query(60, ge=1, le=200),
    _role: Annotated[None, require_role("buyer")] = None,
    db: Session = Depends(get_db),
) -> list[BrowseLotOut]:
    """Open lots near the buyer (their profile location, or an explicit lat/lon).
    Same distance model as the matcher."""
    from app.services.discovery import browse_lots as _browse

    return [
        BrowseLotOut(**r)
        for r in _browse(db, current_user, crop=crop, lat=lat, lon=lon,
                         radius_km=radius_km, limit=limit)
    ]


@router.post("/{lot_id}/express-interest", response_model=ExpressInterestResult)
def express_interest_in_lot(
    lot_id: int,
    current_user: CurrentUser,
    _role: Annotated[None, require_role("buyer")] = None,
    db: Session = Depends(get_db),
) -> ExpressInterestResult:
    """Try to open a match between this lot and one of the buyer's open demands
    for the same crop (the closest-fit one). 409 if the buyer has no such demand."""
    lot = db.get(Lot, lot_id)
    if lot is None or lot.status != "open":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lot not found or not open")

    demands = db.execute(
        select(Demand).where(
            Demand.buyer_id == current_user.id,
            Demand.status == "open",
            Demand.crop.ilike(lot.crop),
        )
    ).scalars().all()
    if not demands:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Post an open demand for {lot.crop} first, then express interest.",
        )

    from app.services.matching import try_pair

    # Stop at the first demand that clears the bar (try_pair upserts a Match as
    # a side effect, so we must not fan it out across every demand); otherwise
    # report the closest near-miss.
    best: dict | None = None
    for dem in demands:
        r = try_pair(db, lot, dem)
        if r.get("matched"):
            return ExpressInterestResult(**r)
        if best is None or (r.get("score") or -1) > (best.get("score") or -1):
            best = r
    return ExpressInterestResult(**(best or {"matched": False}))


@router.get("/{lot_id}", response_model=LotResponse)
def get_lot(
    lot_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> LotResponse:
    """Return a single lot.

    Accessible by the owning farmer, or a buyer who has a match on this lot.
    """
    lot = db.execute(select(Lot).where(Lot.id == lot_id)).scalar_one_or_none()
    if lot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lot not found")

    if current_user.id == lot.farmer_id:
        return LotResponse.model_validate(lot)

    # Buyers may view a lot only if they have a match against it.
    buyer_match = db.execute(
        select(Match)
        .join(Demand, Match.demand_id == Demand.id)
        .where(Match.lot_id == lot_id, Demand.buyer_id == current_user.id)
    ).scalar_one_or_none()

    if buyer_match is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return LotResponse.model_validate(lot)
