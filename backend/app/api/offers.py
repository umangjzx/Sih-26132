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
from app.models.price_cache import PriceCache
from app.schemas.offer import DealResponse, OfferCreate, OfferResponse
from app.services.audit import log_event

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


def _latest_mandi_modal(db: Session, crop: str, district: str, state: str) -> tuple[float | None, str]:
    """Most recent modal price for ``crop``: try the lot's district, then its
    state, then all-India. Returns (price, basis)."""
    base = select(PriceCache.modal_price).where(PriceCache.crop == crop).order_by(
        PriceCache.date.desc()
    ).limit(1)
    for scope, cond in (
        (f"{district} district", PriceCache.district == district),
        (f"{state}", PriceCache.state == state),
        ("all-India", None),
    ):
        if cond is None:
            val = db.execute(base).scalar_one_or_none()
        elif not scope.strip():
            continue
        else:
            val = db.execute(base.where(cond)).scalar_one_or_none()
        if val is not None:
            return round(float(val), 0), scope
    return None, "no data"


# ---------------------------------------------------------------------------
# GET /api/matches/{match_id}/negotiation — decision context for a counter
# ---------------------------------------------------------------------------

@router.get("/api/matches/{match_id}/negotiation")
def negotiation_context(
    match_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> dict:
    """Everything the caller needs to counter with an informed number: each
    side's last offer, the current spread, a suggested midpoint, and the
    mandi/MSP/asking-band references for the crop."""
    from app.services import reference as ref

    match, lot, demand = _load_match_with_access(match_id, current_user.id, db)
    offers = db.execute(
        select(Offer).where(Offer.match_id == match_id).order_by(Offer.created_at.asc())
    ).scalars().all()

    def _last_from(uid: int) -> dict | None:
        for o in reversed(offers):
            if o.from_user_id == uid:
                return {"price": o.price, "quantity": o.quantity, "status": o.status,
                        "offer_id": o.id}
        return None

    farmer_last = _last_from(lot.farmer_id)
    buyer_last = _last_from(demand.buyer_id)
    pending = next((o for o in offers if o.status == "pending"), None)

    spread = None
    midpoint = None
    if farmer_last and buyer_last:
        spread = round(abs(farmer_last["price"] - buyer_last["price"]), 0)
        midpoint = round((farmer_last["price"] + buyer_last["price"]) / 2, 0)
    else:
        band_mid = round((demand.price_band_min + demand.price_band_max) / 2, 0)
        midpoint = round((lot.expected_price + band_mid) / 2, 0)

    mandi, mandi_basis = _latest_mandi_modal(
        db, lot.crop, lot.location or "", getattr(lot, "state", "") or ""
    )
    msp_entry = ref.msp_for(lot.crop)

    return {
        "match_id": match_id,
        "crop": lot.crop,
        "match_status": match.status,
        "you_are": "farmer" if current_user.id == lot.farmer_id else "buyer",
        "farmer_last_offer": farmer_last,
        "buyer_last_offer": buyer_last,
        "pending_offer": (
            {"price": pending.price, "quantity": pending.quantity,
             "offer_id": pending.id, "from_you": pending.from_user_id == current_user.id}
            if pending else None
        ),
        "spread_per_qtl": spread,
        "suggested_midpoint_per_qtl": midpoint,
        "references": {
            "lot_expected_price": lot.expected_price,
            "demand_price_band": [demand.price_band_min, demand.price_band_max],
            "mandi_modal_per_qtl": mandi,
            "mandi_basis": mandi_basis,
            "msp_per_qtl": msp_entry["price"] if msp_entry else None,
        },
    }


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
    db.flush()
    log_event(
        db, actor_id=current_user.id, entity_type="match", entity_id=match_id,
        action="offer_countered" if pending else "offer_made",
        detail={"price": body.price, "quantity": body.quantity, "offer_id": offer.id},
    )
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
    db.flush()
    log_event(
        db, actor_id=current_user.id, entity_type="match", entity_id=match.id,
        action="offer_accepted",
        detail={"offer_id": offer.id, "price": offer.price, "quantity": offer.quantity},
    )
    log_event(
        db, actor_id=current_user.id, entity_type="deal", entity_id=deal.id,
        action="deal_created",
        detail={"from": "offer", "agreed_price": deal.agreed_price,
                "agreed_quantity": deal.agreed_quantity},
    )
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

    db.flush()
    log_event(
        db, actor_id=current_user.id, entity_type="match", entity_id=offer.match_id,
        action="offer_declined", detail={"offer_id": offer.id},
    )
    db.commit()
    return {"detail": "Offer declined"}
