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
