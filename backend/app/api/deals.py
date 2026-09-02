"""Deal pipeline endpoints (Phase 3, D-01..D-04).

- GET   /api/deals/mine              — deals for the current user.
    Farmer: deals whose lot belongs to them.
    Buyer:  deals whose demand belongs to them.
    Admin:  all deals.
- GET   /api/deals/{deal_id}         — single deal, farmer / buyer / admin only.
- PATCH /api/deals/{deal_id}/advance — advance pipeline_status by exactly one
    linear step: matched -> offer_accepted -> logistics_arranged -> delivered
    -> paid -> closed. Out-of-order or advancing a 'closed' deal -> HTTP 400.
    When the new status is 'paid', payment_status is set to 'paid' (D-04).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.matching import _counterparty, _demand_summary, _lot_summary
from app.core.database import get_db
from app.core.security import CurrentUser
from app.models.deal import Deal
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.models.user import User
from app.schemas.deal import DealDetailResponse


class AdvanceBody(BaseModel):
    payment_method: str | None = Field(default=None, max_length=40)
    payment_reference: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=500)

router = APIRouter(tags=["deals"])
logger = logging.getLogger(__name__)

PIPELINE_STAGES = [
    "matched",
    "offer_accepted",
    "logistics_arranged",
    "delivered",
    "paid",
    "closed",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_deal_with_access(
    deal_id: int, user: User, db: Session
) -> tuple[Deal, Match, Lot, Demand]:
    """Load Deal + Match + Lot + Demand and verify the caller may act on it.

    Access: farmer of the lot, buyer of the demand, or an admin. 403 otherwise.
    404 if the deal does not exist.
    """
    row = db.execute(
        select(Deal, Match, Lot, Demand)
        .join(Match, Deal.match_id == Match.id)
        .join(Lot, Match.lot_id == Lot.id)
        .join(Demand, Match.demand_id == Demand.id)
        .where(Deal.id == deal_id)
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    deal, match, lot, demand = row
    if (
        user.role != "admin"
        and user.id != lot.farmer_id
        and user.id != demand.buyer_id
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return deal, match, lot, demand


def _assemble_detail(
    deal: Deal, lot: Lot, demand: Demand, viewer: User, db: Session
) -> DealDetailResponse:
    """Build a DealDetailResponse with the counterparty resolved for ``viewer``."""
    if viewer.id == lot.farmer_id:
        cp_id = demand.buyer_id
    elif viewer.id == demand.buyer_id:
        cp_id = lot.farmer_id
    else:
        # admin viewer — default the counterparty view to the buyer
        cp_id = demand.buyer_id
    cp_user = db.execute(select(User).where(User.id == cp_id)).scalar_one_or_none()
    return DealDetailResponse(
        id=deal.id,
        match_id=deal.match_id,
        agreed_price=deal.agreed_price,
        agreed_quantity=deal.agreed_quantity,
        logistics_mode=deal.logistics_mode,
        payment_status=deal.payment_status,
        pipeline_status=deal.pipeline_status,
        payment_method=deal.payment_method,
        payment_reference=deal.payment_reference,
        created_at=deal.created_at,
        lot=_lot_summary(lot),
        demand=_demand_summary(demand),
        counterparty=_counterparty(cp_user) if cp_user else None,
    )


# ---------------------------------------------------------------------------
# GET /api/deals/mine
# ---------------------------------------------------------------------------

@router.get("/api/deals/mine", response_model=list[DealDetailResponse])
def list_my_deals(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> list[DealDetailResponse]:
    stmt = (
        select(Deal, Lot, Demand)
        .join(Match, Deal.match_id == Match.id)
        .join(Lot, Match.lot_id == Lot.id)
        .join(Demand, Match.demand_id == Demand.id)
    )
    if current_user.role == "farmer":
        stmt = stmt.where(Lot.farmer_id == current_user.id)
    elif current_user.role == "buyer":
        stmt = stmt.where(Demand.buyer_id == current_user.id)
    # admin: no filter — all deals
    stmt = stmt.order_by(Deal.created_at.desc(), Deal.id.desc())

    rows = db.execute(stmt).all()
    return [
        _assemble_detail(deal, lot, demand, current_user, db)
        for deal, lot, demand in rows
    ]


# ---------------------------------------------------------------------------
# GET /api/deals/{deal_id}
# ---------------------------------------------------------------------------

@router.get("/api/deals/{deal_id}", response_model=DealDetailResponse)
def get_deal(
    deal_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> DealDetailResponse:
    deal, _match, lot, demand = _load_deal_with_access(deal_id, current_user, db)
    return _assemble_detail(deal, lot, demand, current_user, db)


# ---------------------------------------------------------------------------
# PATCH /api/deals/{deal_id}/advance
# ---------------------------------------------------------------------------

# Which party may move the deal INTO a given stage. Others → 403.
#   delivered → the seller (lot owner) confirms dispatch/handover
#   paid      → the buyer (demand owner) records the payment
# Every other transition is shared coordination.
_STAGE_ACTOR = {"delivered": "farmer", "paid": "buyer"}


@router.patch("/api/deals/{deal_id}/advance", response_model=DealDetailResponse)
def advance_deal(
    deal_id: int,
    current_user: CurrentUser,
    body: AdvanceBody | None = None,
    db: Session = Depends(get_db),
) -> DealDetailResponse:
    deal, _match, lot, demand = _load_deal_with_access(deal_id, current_user, db)
    body = body or AdvanceBody()

    try:
        idx = PIPELINE_STAGES.index(deal.pipeline_status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown pipeline status '{deal.pipeline_status}'",
        )

    if idx >= len(PIPELINE_STAGES) - 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deal is already closed; cannot advance further",
        )

    new_status = PIPELINE_STAGES[idx + 1]

    # Role gate: the seller confirms delivery, the buyer confirms payment.
    # Admins may push any stage (they are not a party).
    required = _STAGE_ACTOR.get(new_status)
    if required and current_user.role != "admin":
        is_seller = current_user.id == lot.farmer_id
        is_buyer = current_user.id == demand.buyer_id
        if (required == "farmer" and not is_seller) or (required == "buyer" and not is_buyer):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Only the seller can confirm delivery"
                    if required == "farmer"
                    else "Only the buyer can record the payment"
                ),
            )

    if new_status == "paid":
        if current_user.role != "admin" and not (body.payment_reference or "").strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A payment reference (UPI / bank txn id) is required to mark a deal paid",
            )
        deal.payment_status = "paid"
        deal.payment_method = body.payment_method
        deal.payment_reference = body.payment_reference

    deal.pipeline_status = new_status
    db.commit()
    db.refresh(deal)

    logger.info(
        "Deal %d advanced to '%s' by user %d (%s)",
        deal.id, new_status, current_user.id, current_user.role,
    )
    return _assemble_detail(deal, lot, demand, current_user, db)
