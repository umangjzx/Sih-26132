"""Dispute endpoints (Phase 3, D-05..D-07).

- POST  /api/deals/{deal_id}/disputes  — farmer or buyer of the deal raises a
    dispute. 409 if an 'open' dispute already exists on that deal.
- GET   /api/deals/{deal_id}/disputes  — farmer / buyer / admin; ordered
    created_at desc.
- PATCH /api/disputes/{dispute_id}/close — admin only; already-closed -> 400.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.deal import Deal
from app.models.demand import Demand
from app.models.dispute import Dispute
from app.models.lot import Lot
from app.models.match import Match
from app.models.user import User
from app.schemas.deal import DisputeCreate, DisputeResponse

router = APIRouter(tags=["disputes"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_deal_parties(deal_id: int, db: Session) -> tuple[Deal, int, int]:
    """Return (deal, farmer_user_id, buyer_user_id). 404 if the deal is missing."""
    row = db.execute(
        select(Deal, Lot.farmer_id, Demand.buyer_id)
        .join(Match, Deal.match_id == Match.id)
        .join(Lot, Match.lot_id == Lot.id)
        .join(Demand, Match.demand_id == Demand.id)
        .where(Deal.id == deal_id)
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    deal, farmer_id, buyer_id = row
    return deal, farmer_id, buyer_id


# ---------------------------------------------------------------------------
# POST /api/deals/{deal_id}/disputes
# ---------------------------------------------------------------------------

@router.post(
    "/api/deals/{deal_id}/disputes",
    response_model=DisputeResponse,
    status_code=status.HTTP_201_CREATED,
)
def raise_dispute(
    deal_id: int,
    body: DisputeCreate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> DisputeResponse:
    _deal, farmer_id, buyer_id = _load_deal_parties(deal_id, db)
    if current_user.id not in (farmer_id, buyer_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    existing_open = db.execute(
        select(Dispute).where(Dispute.deal_id == deal_id, Dispute.status == "open")
    ).scalars().first()
    if existing_open is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An open dispute already exists for this deal",
        )

    dispute = Dispute(
        deal_id=deal_id,
        raised_by=current_user.id,
        reason=body.reason.strip(),
        status="open",
    )
    db.add(dispute)
    db.commit()
    db.refresh(dispute)

    logger.info("Dispute %d raised on deal %d by user %d", dispute.id, deal_id, current_user.id)
    return DisputeResponse.model_validate(dispute)


# ---------------------------------------------------------------------------
# GET /api/deals/{deal_id}/disputes
# ---------------------------------------------------------------------------

@router.get("/api/deals/{deal_id}/disputes", response_model=list[DisputeResponse])
def list_disputes(
    deal_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> list[DisputeResponse]:
    _deal, farmer_id, buyer_id = _load_deal_parties(deal_id, db)
    if current_user.role != "admin" and current_user.id not in (farmer_id, buyer_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    rows = db.execute(
        select(Dispute)
        .where(Dispute.deal_id == deal_id)
        .order_by(Dispute.created_at.desc(), Dispute.id.desc())
    ).scalars().all()
    return [DisputeResponse.model_validate(d) for d in rows]


# ---------------------------------------------------------------------------
# PATCH /api/disputes/{dispute_id}/close
# ---------------------------------------------------------------------------

@router.patch("/api/disputes/{dispute_id}/close", response_model=DisputeResponse)
def close_dispute(
    dispute_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    _admin: User = require_role("admin"),
) -> DisputeResponse:
    dispute = db.execute(
        select(Dispute).where(Dispute.id == dispute_id)
    ).scalar_one_or_none()
    if dispute is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found")

    if dispute.status == "closed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dispute is already closed",
        )

    dispute.status = "closed"
    db.commit()
    db.refresh(dispute)

    logger.info("Dispute %d closed by admin %d", dispute.id, current_user.id)
    return DisputeResponse.model_validate(dispute)
