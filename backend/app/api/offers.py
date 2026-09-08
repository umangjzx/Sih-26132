"""Offer/counter-offer endpoints and deal creation.

Design (from 2-CONTEXT.md D-23 to D-26):
- POST /api/matches/{match_id}/offers — either party posts; previous pending → countered.
- GET  /api/matches/{match_id}/offers — full thread, ordered created_at asc.
- POST /api/offers/{offer_id}/accept  — other party accepts; creates Deal; match → accepted.
- POST /api/offers/{offer_id}/decline — other party declines; match reverts if no pending left.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import ratelimit
from app.core.database import get_db
from app.core.security import CurrentUser
from app.models.deal import Deal
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.models.notification import Notification
from app.models.offer import Offer
from app.models.price_cache import PriceCache
from app.models.user import User
from app.schemas.offer import DealResponse, OfferCreate, OfferResponse
from app.services.audit import log_event
from app.services.financing_link import link_financing_request_to_deal

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

    farmer = db.get(User, lot.farmer_id)
    mandi, mandi_basis = _latest_mandi_modal(
        db, lot.crop, lot.location or "", (farmer.state if farmer else "") or ""
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

    if not ratelimit.check(f"offer:{match_id}:{current_user.id}", limit=20, window_s=300):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Too many offers on this match. Please slow down.")

    if body.quantity > lot.quantity_kg + 1e-6:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"You can't offer for more than the lot's {lot.quantity_kg:.0f} kg.",
        )

    # Move any existing pending offer to 'countered'
    pending = db.execute(
        select(Offer).where(Offer.match_id == match_id, Offer.status == "pending")
    ).scalars().all()
    if any(p.from_user_id == current_user.id for p in pending):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Your offer is already on the table — wait for the other party to respond.",
        )
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
    try:
        db.flush()
    except IntegrityError:
        # Two near-simultaneous posts on this match (double-submit, or both
        # parties posting at the same instant) both passed the "no pending
        # offer of mine" check above — the uq_offer_pending_per_match
        # constraint catches what the read missed.
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Someone just posted an offer on this match — refresh and try again.",
        )
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

    # The offer can still be "pending" even after its match was already killed
    # off — e.g. a sibling match on the same lot got accepted first, which
    # auto-rejects this match but doesn't touch offers sitting on it. Without
    # this check, accepting here creates a second Deal on an already-committed
    # lot.
    if match.status not in ("proposed", "offered"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This match is '{match.status}' — it's no longer open to act on.",
        )

    # Must be the other party — not the one who made the offer
    if offer.from_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot accept your own offer",
        )

    # Everything above is a plain read — two concurrent accept calls (a
    # double-click, two tabs, or two different pending offers on the same
    # match) can both sail through those checks before either writes. Claim
    # the offer AND the match atomically here — a conditional UPDATE with a
    # WHERE on the still-expected status — so only one request can win; the
    # loser's rowcount is 0 and it's told to retry instead of silently
    # creating a second Deal for the same match.
    claimed_offer = db.execute(
        update(Offer)
        .where(Offer.id == offer.id, Offer.status == "pending")
        .values(status="accepted")
    ).rowcount
    claimed_match = db.execute(
        update(Match)
        .where(Match.id == match.id, Match.status.in_(("proposed", "offered")))
        .values(status="accepted")
    ).rowcount
    if not claimed_offer or not claimed_match:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This offer was just acted on elsewhere — refresh and try again.",
        )
    db.refresh(offer)
    db.refresh(match)

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

    # match.status was already flipped atomically above. Take the lot + demand
    # off the open market so the matcher and discovery board stop offering an
    # already-committed lot — atomically, same reasoning as the match/offer
    # claim: a sibling match on this same lot or demand (including one
    # materialised by a pool's accept-demand, which doesn't go through this
    # function's own match at all) could be getting accepted at the same
    # instant, and both would otherwise pass a plain status != "matched"
    # check before either commits.
    claimed_lot = db.execute(
        update(Lot).where(Lot.id == lot.id, Lot.status == "open").values(status="matched")
    ).rowcount
    claimed_demand = db.execute(
        update(Demand).where(Demand.id == demand.id, Demand.status == "open").values(status="matched")
    ).rowcount
    if not claimed_lot or not claimed_demand:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This lot or demand was just committed elsewhere — refresh and try again.",
        )
    db.refresh(lot)
    db.refresh(demand)

    # Any other still-open matches for this lot or demand are now moot.
    siblings = db.execute(
        select(Match).where(
            Match.id != match.id,
            Match.status.in_(("proposed", "offered")),
            (Match.lot_id == lot.id) | (Match.demand_id == demand.id),
        )
    ).scalars().all()
    for sib in siblings:
        sib.status = "rejected"

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
    link_financing_request_to_deal(db, lot.id, deal.id)
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
    db.add(Notification(
        user_id=offer.from_user_id,
        kind="deal",
        title=f"Your offer for {lot.crop} was accepted",
        body=f"Deal #{deal.id} — {deal.agreed_quantity:.0f} kg at ₹{deal.agreed_price:.0f}/qtl.",
        link=f"/deals/{deal.id}",
    ))
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

    # Same stale-match guard as accept_offer — otherwise declining a leftover
    # pending offer on an already-rejected match resurrects it back to
    # 'proposed' (see the "no pending left" branch below).
    if match.status not in ("proposed", "offered"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This match is '{match.status}' — it's no longer open to act on.",
        )

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
    db.add(Notification(
        user_id=offer.from_user_id,
        kind="deal",
        title=f"Your offer for {lot.crop} was declined",
        body=f"₹{offer.price:.0f}/qtl for {offer.quantity:.0f} kg was declined — you can make a new offer.",
        link=f"/matches/{offer.match_id}",
    ))
    db.commit()
    return {"detail": "Offer declined"}
