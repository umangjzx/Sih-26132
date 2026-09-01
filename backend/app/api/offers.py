"""Offer/counter-offer endpoints and deal creation.

Design (from 2-CONTEXT.md D-23 to D-26):
- POST /api/matches/{match_id}/offers — either party posts; previous pending → countered.
- GET  /api/matches/{match_id}/offers — full thread, ordered created_at asc.
- POST /api/offers/{offer_id}/accept  — other party accepts; creates Deal; match → accepted.
- POST /api/offers/{offer_id}/decline — other party declines; match reverts if no pending left.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser
from app.models.deal import Deal
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.models.offer import Offer
from app.schemas.offer import DealResponse, OfferCreate, OfferResponse

router = APIRouter(tags=["offers"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_match_with_access(match_id: int, user_id: int, db: Session) -> tuple[Match, Lot, Demand]:
    """Load Match+Lot+Demand and verify the caller is a party to the match."""
    row = db.execute(
        select(Match, Lot, Demand)
        .join(Lot, Match.lot_id == Lot.id)
        .join(Demand, Match.demand_id == Demand.id)
        .where(Match.id == match_id)
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    match, lot, demand = row
    if user_id != lot.farmer_id and user_id != demand.buyer_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return match, lot, demand


# ---------------------------------------------------------------------------
# POST /api/matches/{match_id}/offers
# ---------------------------------------------------------------------------

@router.post(
    "/api/matches/{match_id}/offers",
    response_model=OfferResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_offer(
    match_id: int,
    body: OfferCreate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> OfferResponse:
    """Post an offer (or counter-offer) on a match.

    The match must be in 'proposed' or 'offered' status.
    Any existing pending offer on this match is moved to 'countered'.
    """
    match, lot, demand = _load_match_with_access(match_id, current_user.id, db)

    if match.status not in ("proposed", "offered"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Match status '{match.status}' is not open for offers",
        )

    # Move any existing pending offer to 'countered'
    pending = db.execute(
        select(Offer).where(Offer.match_id == match_id, Offer.status == "pending")
    ).scalars().all()
    for p in pending:
        p.status = "countered"

    # Create new offer
    offer = Offer(
        match_id=match_id,
        from_user_id=current_user.id,
        price=body.price,
        quantity=body.quantity,
        message=body.message,
        status="pending",
    )
    db.add(offer)
    match.status = "offered"
    db.commit()
    db.refresh(offer)

    return OfferResponse.model_validate(offer)


# ---------------------------------------------------------------------------
# GET /api/matches/{match_id}/offers
# ---------------------------------------------------------------------------

@router.get(
    "/api/matches/{match_id}/offers",
    response_model=list[OfferResponse],
)
def get_offer_thread(
    match_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> list[OfferResponse]:
    """Return the full offer thread for a match, ordered oldest-first."""
    _load_match_with_access(match_id, current_user.id, db)  # access check only

    offers = db.execute(
        select(Offer)
        .where(Offer.match_id == match_id)
        .order_by(Offer.created_at.asc())
    ).scalars().all()
    return [OfferResponse.model_validate(o) for o in offers]


# ---------------------------------------------------------------------------
# POST /api/offers/{offer_id}/accept
# ---------------------------------------------------------------------------

@router.post(
    "/api/offers/{offer_id}/accept",
    response_model=DealResponse,
)
def accept_offer(
    offer_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> DealResponse:
    """Accept a pending offer.

    The caller must be the *other* party (not the one who made the offer).
    Creates a Deal row and marks the match as accepted.
    """
    offer = db.execute(select(Offer).where(Offer.id == offer_id)).scalar_one_or_none()
    if offer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found")

    if offer.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Offer status is '{offer.status}', not pending",
        )

    match, lot, demand = _load_match_with_access(offer.match_id, current_user.id, db)

    # Must be the other party — not the one who made the offer
    if offer.from_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot accept your own offer",
        )

    # Accept this offer
    offer.status = "accepted"

    # Decline all other pending offers on this match
    other_pending = db.execute(
        select(Offer).where(
            Offer.match_id == offer.match_id,
            Offer.status == "pending",
            Offer.id != offer_id,
        )
    ).scalars().all()
    for o in other_pending:
        o.status = "declined"

    # Advance match status
    match.status = "accepted"

    # Create the Deal
    deal = Deal(
        match_id=match.id,
        agreed_price=offer.price,
        agreed_quantity=offer.quantity,
        logistics_mode="self_pickup",
        payment_status="pending",
        pipeline_status="matched",
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)

    logger.info(
        "Deal %d created: match %d, price %.2f, qty %.2f",
        deal.id, match.id, deal.agreed_price, deal.agreed_quantity,
    )
    return DealResponse.model_validate(deal)


# ---------------------------------------------------------------------------
# POST /api/offers/{offer_id}/decline
# ---------------------------------------------------------------------------

@router.post(
    "/api/offers/{offer_id}/decline",
)
def decline_offer(
    offer_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> dict:
    """Decline a pending offer.

    The caller must be the other party (not the maker).
    If no pending offers remain, match reverts to 'proposed'.
    """
    offer = db.execute(select(Offer).where(Offer.id == offer_id)).scalar_one_or_none()
    if offer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found")

    if offer.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Offer status is '{offer.status}', not pending",
        )

    match, lot, demand = _load_match_with_access(offer.match_id, current_user.id, db)

    if offer.from_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot decline your own offer",
        )

    offer.status = "declined"

    # Revert match to 'proposed' if no pending offers remain
    remaining_pending = db.execute(
        select(Offer).where(
            Offer.match_id == offer.match_id,
            Offer.status == "pending",
            Offer.id != offer_id,
        )
    ).scalars().first()

    if remaining_pending is None:
        match.status = "proposed"

    db.commit()
    return {"detail": "Offer declined"}
