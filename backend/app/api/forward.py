"""Forward contracts (v1.6) — pre-harvest market linkage.

A buyer posts a forward bid (how much of a crop they will buy, price band,
future delivery window). A farmer commits part of a not-yet-harvested crop
against it, locking a price before harvest. When the buyer accepts, the
commitment materialises into the normal deal pipeline.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.deal import Deal
from app.models.demand import Demand
from app.models.forward import ForwardBid, ForwardCommitment
from app.models.lot import Lot
from app.models.match import Match
from app.models.offer import Offer
from app.models.user import User
from app.schemas.forward import (
    ForwardBidCreate,
    ForwardBidDetail,
    ForwardBidOut,
    ForwardCommitmentCreate,
    ForwardCommitmentOut,
    ForwardCommitmentResult,
)
from app.services import reference as ref
from app.services.audit import log_event
from app.services.geo import _district_coord, haversine_km

router = APIRouter(prefix="/api/forward", tags=["forward"])
logger = logging.getLogger(__name__)

_ACTIVE_COMMITMENT = ("pending", "accepted")


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #

def _fill(db: Session, bid_id: int) -> tuple[float, float]:
    """(committed_kg incl. pending, accepted_kg) for a bid."""
    rows = db.execute(
        select(ForwardCommitment.status, func.coalesce(func.sum(ForwardCommitment.quantity_kg), 0.0))
        .where(ForwardCommitment.bid_id == bid_id)
        .group_by(ForwardCommitment.status)
    ).all()
    by = {s: float(q) for s, q in rows}
    committed = by.get("pending", 0.0) + by.get("accepted", 0.0)
    return round(committed, 1), round(by.get("accepted", 0.0), 1)


def _calendar_warning(crop: str, ready: date, bid: ForwardBid) -> str | None:
    cal = ref.calendar_for(crop)
    if cal is None:
        return None
    entry = None
    # calendar_for returns labels; re-read raw months for the month check
    from app.services.reference import CALENDAR

    raw = CALENDAR.get(crop.strip()) or CALENDAR.get(crop.strip().title())
    if raw and ready.month not in raw["harvest"]:
        entry = (
            f"{crop} is usually harvested in {cal['harvest_months']}; a ready date in "
            f"{ready.strftime('%B')} may not line up."
        )
    if ready > bid.delivery_to or ready < bid.delivery_from - timedelta(days=21):
        w = "Ready date sits outside the buyer's delivery window."
        entry = f"{entry} {w}" if entry else w
    return entry


def _enrich_commitment(db: Session, c: ForwardCommitment, bid: ForwardBid) -> ForwardCommitmentOut:
    out = ForwardCommitmentOut.model_validate(c)
    farmer = db.get(User, c.farmer_id)
    if farmer:
        out.farmer_name = farmer.name
        out.farmer_district = farmer.district or ""
        out.farmer_verified = getattr(farmer, "verification_status", "") == "verified"
    out.calendar_warning = _calendar_warning(bid.crop, c.expected_ready, bid)
    return out


def _enrich_bid(
    db: Session, bid: ForwardBid, viewer: User,
    origin: tuple[float, float] | None = None,
) -> ForwardBidOut:
    out = ForwardBidOut.model_validate(bid)
    buyer = db.get(User, bid.buyer_id)
    if buyer:
        out.buyer_name = buyer.name
        out.buyer_verified = getattr(buyer, "verification_status", "") == "verified"

    committed, accepted = _fill(db, bid.id)
    out.committed_kg = committed
    out.accepted_kg = accepted
    out.remaining_kg = round(max(bid.quantity_kg - accepted, 0.0), 1)
    out.fill_pct = round(accepted / bid.quantity_kg * 100, 1) if bid.quantity_kg else 0.0

    cal = ref.calendar_for(bid.crop)
    out.harvest_window = cal["harvest_months"] if cal else None

    coords = (
        (bid.latitude, bid.longitude)
        if bid.latitude is not None and bid.longitude is not None
        else _district_coord(bid.delivery_district or "")
    )
    if origin and coords:
        out.distance_km = round(haversine_km(origin, coords), 1)

    if viewer.role == "farmer":
        mine = db.execute(
            select(ForwardCommitment)
            .where(
                ForwardCommitment.bid_id == bid.id,
                ForwardCommitment.farmer_id == viewer.id,
            )
            .order_by(ForwardCommitment.created_at.desc())
        ).scalars().first()
        if mine:
            out.my_commitment = _enrich_commitment(db, mine, bid)
    return out


def _viewer_origin(user: User, lat: float | None, lon: float | None) -> tuple[float, float] | None:
    if lat is not None and lon is not None:
        return (lat, lon)
    if user.latitude is not None and user.longitude is not None:
        return (user.latitude, user.longitude)
    return _district_coord(user.district or "")


# --------------------------------------------------------------------------- #
# bids
# --------------------------------------------------------------------------- #

@router.post("/bids", response_model=ForwardBidOut, status_code=status.HTTP_201_CREATED)
def create_bid(
    body: ForwardBidCreate,
    current_user: CurrentUser,
    _role: Annotated[User, require_role("buyer")] = None,  # type: ignore[assignment]
    db: Session = Depends(get_db),
) -> ForwardBidOut:
    bid = ForwardBid(
        buyer_id=current_user.id,
        crop=body.crop.strip(),
        quantity_kg=body.quantity_kg,
        price_min=body.price_min,
        price_max=body.price_max,
        delivery_from=body.delivery_from,
        delivery_to=body.delivery_to,
        delivery_district=(body.delivery_district or current_user.district or "").strip(),
        latitude=body.latitude if body.latitude is not None else current_user.latitude,
        longitude=body.longitude if body.longitude is not None else current_user.longitude,
        quality_grade_min=body.quality_grade_min,
        notes=body.notes,
        status="open",
    )
    db.add(bid)
    db.flush()
    log_event(
        db, actor_id=current_user.id, entity_type="forward_bid", entity_id=bid.id,
        action="forward_bid_created",
        detail={"crop": bid.crop, "quantity_kg": bid.quantity_kg,
                "price_band": [bid.price_min, bid.price_max],
                "window": [bid.delivery_from.isoformat(), bid.delivery_to.isoformat()]},
    )
    db.commit()
    db.refresh(bid)
    return _enrich_bid(db, bid, current_user)


@router.get("/bids", response_model=list[ForwardBidOut])
def list_bids(
    current_user: CurrentUser,
    crop: str | None = None,
    mine: bool = False,
    status_filter: str | None = Query(None, alias="status"),
    lat: float | None = None,
    lon: float | None = None,
    radius_km: float | None = Query(None, ge=10, le=1000),
    db: Session = Depends(get_db),
) -> list[ForwardBidOut]:
    stmt = select(ForwardBid).order_by(ForwardBid.created_at.desc())
    if mine and current_user.role == "buyer":
        stmt = stmt.where(ForwardBid.buyer_id == current_user.id)
    else:
        stmt = stmt.where(ForwardBid.status == (status_filter or "open"))
    if status_filter and mine:
        stmt = stmt.where(ForwardBid.status == status_filter)
    if crop:
        stmt = stmt.where(ForwardBid.crop.ilike(crop))

    origin = _viewer_origin(current_user, lat, lon)
    bids = list(db.execute(stmt).scalars().all())
    out = [_enrich_bid(db, b, current_user, origin) for b in bids]
    if radius_km is not None:
        out = [b for b in out if b.distance_km is None or b.distance_km <= radius_km]
    return out


@router.get("/bids/{bid_id}", response_model=ForwardBidDetail)
def get_bid(
    bid_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> ForwardBidDetail:
    bid = db.get(ForwardBid, bid_id)
    if bid is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Forward bid not found")
    base = _enrich_bid(db, bid, current_user, _viewer_origin(current_user, None, None))
    detail = ForwardBidDetail(**base.model_dump())

    show_all = current_user.role == "admin" or current_user.id == bid.buyer_id
    cstmt = select(ForwardCommitment).where(ForwardCommitment.bid_id == bid_id)
    if not show_all:
        cstmt = cstmt.where(ForwardCommitment.farmer_id == current_user.id)
    cstmt = cstmt.order_by(ForwardCommitment.created_at.asc())
    detail.commitments = [
        _enrich_commitment(db, c, bid) for c in db.execute(cstmt).scalars().all()
    ]
    return detail


@router.patch("/bids/{bid_id}", response_model=ForwardBidOut)
def update_bid_status(
    bid_id: int,
    current_user: CurrentUser,
    new_status: str = Query(..., alias="status", pattern="^(open|closed|cancelled)$"),
    db: Session = Depends(get_db),
) -> ForwardBidOut:
    bid = db.get(ForwardBid, bid_id)
    if bid is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Forward bid not found")
    if bid.buyer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the buyer can change this bid")
    if bid.status == "filled":
        raise HTTPException(status.HTTP_409_CONFLICT, "A filled bid can't be reopened or cancelled")
    bid.status = new_status
    log_event(
        db, actor_id=current_user.id, entity_type="forward_bid", entity_id=bid.id,
        action=f"forward_bid_{new_status}", detail={},
    )
    db.commit()
    db.refresh(bid)
    return _enrich_bid(db, bid, current_user)


# --------------------------------------------------------------------------- #
# commitments
# --------------------------------------------------------------------------- #

@router.post(
    "/bids/{bid_id}/commitments",
    response_model=ForwardCommitmentOut,
    status_code=status.HTTP_201_CREATED,
)
def commit_to_bid(
    bid_id: int,
    body: ForwardCommitmentCreate,
    current_user: CurrentUser,
    _role: Annotated[User, require_role("farmer")] = None,  # type: ignore[assignment]
    db: Session = Depends(get_db),
) -> ForwardCommitmentOut:
    bid = db.get(ForwardBid, bid_id)
    if bid is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Forward bid not found")
    if bid.status != "open":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Bid is '{bid.status}', not open for commitments")
    if not (bid.price_min <= body.price_per_qtl <= bid.price_max):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"price_per_qtl must be within the bid band ₹{bid.price_min:.0f}–{bid.price_max:.0f}",
        )
    existing = db.execute(
        select(ForwardCommitment).where(
            ForwardCommitment.bid_id == bid_id,
            ForwardCommitment.farmer_id == current_user.id,
            ForwardCommitment.status.in_(_ACTIVE_COMMITMENT),
        )
    ).scalars().first()
    if existing:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "You already have an active commitment on this bid — withdraw it first to change terms.",
        )
    _committed, accepted = _fill(db, bid_id)
    if accepted + body.quantity_kg > bid.quantity_kg + 1e-6:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Only {max(bid.quantity_kg - accepted, 0):.0f} kg of this bid is still open.",
        )

    c = ForwardCommitment(
        bid_id=bid_id,
        farmer_id=current_user.id,
        quantity_kg=body.quantity_kg,
        price_per_qtl=body.price_per_qtl,
        expected_ready=body.expected_ready,
        note=body.note,
        status="pending",
    )
    db.add(c)
    db.flush()
    log_event(
        db, actor_id=current_user.id, entity_type="forward_bid", entity_id=bid_id,
        action="forward_commitment_made",
        detail={"commitment_id": c.id, "quantity_kg": c.quantity_kg,
                "price_per_qtl": c.price_per_qtl, "expected_ready": c.expected_ready.isoformat()},
    )
    db.commit()
    db.refresh(c)
    return _enrich_commitment(db, c, bid)


def _load_commitment_as_buyer(commitment_id: int, user: User, db: Session) -> tuple[ForwardCommitment, ForwardBid]:
    c = db.get(ForwardCommitment, commitment_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commitment not found")
    bid = db.get(ForwardBid, c.bid_id)
    if bid is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Forward bid not found")
    if bid.buyer_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the bid's buyer can act on this commitment")
    return c, bid


@router.post("/commitments/{commitment_id}/accept", response_model=ForwardCommitmentResult)
def accept_commitment(
    commitment_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> ForwardCommitmentResult:
    """Buyer accepts a farmer's forward commitment — it materialises into the
    normal deal pipeline (Lot + Match + Offer + Deal at 'matched')."""
    c, bid = _load_commitment_as_buyer(commitment_id, current_user, db)
    if c.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Commitment is '{c.status}', not pending")

    farmer = db.get(User, c.farmer_id)
    lot = Lot(
        farmer_id=c.farmer_id, crop=bid.crop, quantity_kg=c.quantity_kg,
        quality_grade=bid.quality_grade_min or "FAQ", expected_price=c.price_per_qtl,
        available_from=c.expected_ready,
        location=(farmer.district if farmer else "") or bid.delivery_district or "",
        latitude=farmer.latitude if farmer else None,
        longitude=farmer.longitude if farmer else None,
        status="matched",
    )
    db.add(lot)
    db.flush()

    demand = Demand(
        buyer_id=bid.buyer_id, crop=bid.crop, quantity_kg=c.quantity_kg,
        quality_spec=f"Forward contract (grade ≥ {bid.quality_grade_min or 'FAQ'})",
        quality_grade_min=bid.quality_grade_min,
        price_band_min=bid.price_min, price_band_max=bid.price_max,
        delivery_window=f"{bid.delivery_from.isoformat()} to {bid.delivery_to.isoformat()}",
        delivery_district=bid.delivery_district or "",
        latitude=bid.latitude, longitude=bid.longitude, status="matched",
    )
    db.add(demand)
    db.flush()

    match = Match(lot_id=lot.id, demand_id=demand.id, score=100.0, status="accepted")
    db.add(match)
    db.flush()
    db.add(Offer(
        match_id=match.id, from_user_id=c.farmer_id, price=c.price_per_qtl,
        quantity=c.quantity_kg, message=f"Forward commitment #{c.id}", status="accepted",
    ))
    deal = Deal(
        match_id=match.id, agreed_price=c.price_per_qtl, agreed_quantity=c.quantity_kg,
        logistics_mode="hired_transport", payment_status="pending", pipeline_status="matched",
    )
    db.add(deal)
    db.flush()

    c.status = "accepted"
    c.deal_id = deal.id
    db.flush()
    _committed, accepted = _fill(db, bid.id)
    if accepted >= bid.quantity_kg - 1e-6:
        bid.status = "filled"

    log_event(
        db, actor_id=current_user.id, entity_type="forward_bid", entity_id=bid.id,
        action="forward_commitment_accepted",
        detail={"commitment_id": c.id, "deal_id": deal.id, "farmer_id": c.farmer_id,
                "quantity_kg": c.quantity_kg, "price_per_qtl": c.price_per_qtl,
                "bid_status": bid.status},
    )
    log_event(
        db, actor_id=current_user.id, entity_type="deal", entity_id=deal.id,
        action="deal_created",
        detail={"from": "forward", "bid_id": bid.id, "commitment_id": c.id,
                "agreed_price": deal.agreed_price, "agreed_quantity": deal.agreed_quantity},
    )
    db.commit()
    logger.info("Forward commitment %d accepted -> deal %d", c.id, deal.id)
    return ForwardCommitmentResult(commitment_id=c.id, status=c.status, deal_id=deal.id)


@router.post("/commitments/{commitment_id}/decline", response_model=ForwardCommitmentResult)
def decline_commitment(
    commitment_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> ForwardCommitmentResult:
    c, bid = _load_commitment_as_buyer(commitment_id, current_user, db)
    if c.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Commitment is '{c.status}', not pending")
    c.status = "declined"
    log_event(
        db, actor_id=current_user.id, entity_type="forward_bid", entity_id=bid.id,
        action="forward_commitment_declined", detail={"commitment_id": c.id},
    )
    db.commit()
    return ForwardCommitmentResult(commitment_id=c.id, status=c.status)


@router.post("/commitments/{commitment_id}/withdraw", response_model=ForwardCommitmentResult)
def withdraw_commitment(
    commitment_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> ForwardCommitmentResult:
    c = db.get(ForwardCommitment, commitment_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commitment not found")
    if c.farmer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your commitment")
    if c.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Commitment is '{c.status}', can't withdraw")
    c.status = "withdrawn"
    log_event(
        db, actor_id=current_user.id, entity_type="forward_bid", entity_id=c.bid_id,
        action="forward_commitment_withdrawn", detail={"commitment_id": c.id},
    )
    db.commit()
    return ForwardCommitmentResult(commitment_id=c.id, status=c.status)
