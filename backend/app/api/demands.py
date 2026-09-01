"""Demand endpoints: create and list own."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.demand import Demand
from app.schemas.demand import DemandCreate, DemandResponse

router = APIRouter(prefix="/api/demands", tags=["demands"])


@router.post("/", response_model=DemandResponse, status_code=status.HTTP_201_CREATED)
def create_demand(
    body: DemandCreate,
    current_user: CurrentUser,
    _role: Annotated[None, require_role("buyer")] = None,
    db: Session = Depends(get_db),
) -> DemandResponse:
    """Create a new demand for the authenticated buyer, then trigger match scoring."""
    demand = Demand(buyer_id=current_user.id, **body.model_dump())
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
