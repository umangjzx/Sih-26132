"""Lot endpoints: create, list own, get by id."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.schemas.lot import LotCreate, LotResponse

router = APIRouter(prefix="/api/lots", tags=["lots"])

# Role-gated CurrentUser aliases for this router.
_FarmerOnly = Annotated[Lot, require_role("farmer")]


@router.post("/", response_model=LotResponse, status_code=status.HTTP_201_CREATED)
def create_lot(
    body: LotCreate,
    current_user: CurrentUser,
    _role: Annotated[None, require_role("farmer")] = None,
    db: Session = Depends(get_db),
) -> LotResponse:
    """Create a new lot for the authenticated farmer, then trigger match scoring."""
    lot = Lot(farmer_id=current_user.id, **body.model_dump())
    db.add(lot)
    db.commit()
    db.refresh(lot)

    from app.services.matching import run_matching
    run_matching(db)

    return LotResponse.model_validate(lot)


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
