"""Dispute endpoints.

- POST  /api/deals/{deal_id}/disputes       — a party raises a dispute (+ optional
    evidence URL). 409 if an 'open' dispute already exists on that deal.
- GET   /api/deals/{deal_id}/disputes       — farmer / buyer / admin.
- POST  /api/disputes/{id}/withdraw         — the raiser withdraws their own open one.
- PATCH /api/disputes/{id}/close            — admin resolves it with an outcome + note.
    v1.11: when the deal came from an accepted forward-contract commitment,
    passing ``apply_forward_penalty=true`` (with a clear-fault outcome) marks
    that commitment ``breached`` and records a computed penalty — see
    ``_apply_forward_penalty`` below and ``ForwardCommitment``'s docstring.
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.deal import Deal
from app.models.demand import Demand
from app.models.dispute import Dispute
from app.models.forward import ForwardCommitment
from app.models.lot import Lot
from app.models.match import Match
from app.models.notification import Notification
from app.models.user import User
from app.schemas.deal import DisputeCreate, DisputeResolve, DisputeResponse
from app.services.audit import log_event

# outcome -> which side the ruling found at fault, for the forward-penalty branch.
_OUTCOME_TO_BREACH = {"favour_farmer": "buyer_breach", "favour_buyer": "farmer_breach"}

_IST = ZoneInfo("Asia/Kolkata")

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
        reason=body.reason,
        evidence_url=body.evidence_url,
        status="open",
    )
    db.add(dispute)
    db.flush()
    log_event(
        db, actor_id=current_user.id, entity_type="deal", entity_id=deal_id,
        action="dispute_raised",
        detail={"dispute_id": dispute.id, "reason": dispute.reason[:200],
                "has_evidence": bool(dispute.evidence_url)},
    )
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
# POST /api/disputes/{dispute_id}/withdraw  — the raiser drops their own dispute
# ---------------------------------------------------------------------------

@router.post("/api/disputes/{dispute_id}/withdraw", response_model=DisputeResponse)
def withdraw_dispute(
    dispute_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> DisputeResponse:
    dispute = db.get(Dispute, dispute_id)
    if dispute is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dispute not found")
    if dispute.raised_by != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the person who raised it can withdraw it")
    if dispute.status != "open":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Dispute is '{dispute.status}', not open")
    dispute.status = "withdrawn"
    db.flush()
    log_event(db, actor_id=current_user.id, entity_type="deal", entity_id=dispute.deal_id,
              action="dispute_withdrawn", detail={"dispute_id": dispute.id})
    db.commit()
    db.refresh(dispute)
    return DisputeResponse.model_validate(dispute)


# ---------------------------------------------------------------------------
# PATCH /api/disputes/{dispute_id}/close  — admin resolution
# ---------------------------------------------------------------------------

@router.patch("/api/disputes/{dispute_id}/close", response_model=DisputeResponse)
def close_dispute(
    dispute_id: int,
    current_user: CurrentUser,
    body: DisputeResolve | None = None,
    db: Session = Depends(get_db),
    _admin: User = require_role("admin"),
) -> DisputeResponse:
    dispute = db.execute(
        select(Dispute).where(Dispute.id == dispute_id)
    ).scalar_one_or_none()
    if dispute is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found")

    if dispute.status in ("resolved", "closed", "withdrawn"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dispute is already {dispute.status}",
        )

    outcome = body.outcome if body else "dismissed"

    # Validated (and may raise) *before* anything is mutated, so a rejected
    # apply_forward_penalty never leaves the dispute itself half-resolved.
    commitment = None
    if body is not None and body.apply_forward_penalty:
        commitment = _validate_forward_penalty(db, dispute, outcome)

    dispute.status = "resolved"
    dispute.outcome = outcome
    dispute.resolution = body.resolution if body else None
    dispute.resolved_by = current_user.id
    dispute.resolved_at = datetime.now(_IST)
    db.flush()
    log_event(
        db, actor_id=current_user.id, entity_type="deal", entity_id=dispute.deal_id,
        action="dispute_resolved",
        detail={"dispute_id": dispute.id, "outcome": dispute.outcome},
    )

    _deal, farmer_id, buyer_id = _load_deal_parties(dispute.deal_id, db)
    title = f"Dispute on deal #{dispute.deal_id} resolved: {outcome.replace('_', ' ')}"
    link = f"/deals/{dispute.deal_id}"
    for party_id in {farmer_id, buyer_id}:
        db.add(Notification(user_id=party_id, kind="dispute", title=title, body=dispute.resolution or "", link=link))

    if commitment is not None:
        penalty_inr = round(
            commitment.quantity_kg / 100 * commitment.price_per_qtl * settings.forward_penalty_pct, 2
        )
        breach_status = _OUTCOME_TO_BREACH[outcome]
        commitment.status = "breached"
        commitment.breach_status = breach_status
        commitment.penalty_inr = penalty_inr
        commitment.breached_at = datetime.now(_IST)
        db.flush()
        log_event(
            db, actor_id=current_user.id, entity_type="forward_bid", entity_id=commitment.bid_id,
            action="forward_commitment_breached",
            detail={
                "commitment_id": commitment.id, "deal_id": dispute.deal_id,
                "dispute_id": dispute.id, "breach_status": breach_status,
                "penalty_inr": penalty_inr, "outcome": outcome,
            },
        )

    db.commit()
    db.refresh(dispute)

    logger.info("Dispute %d resolved (%s) by admin %d", dispute.id, dispute.outcome, current_user.id)
    return DisputeResponse.model_validate(dispute)


def _validate_forward_penalty(db: Session, dispute: Dispute, outcome: str) -> ForwardCommitment:
    """Read-only guard for ``apply_forward_penalty`` — raises 422/409 and
    changes nothing if a penalty can't be applied; otherwise returns the
    ``ForwardCommitment`` to breach. Only valid for a dispute whose deal
    originated from a still-``accepted`` forward commitment, and only for a
    clear-fault outcome (favour_farmer / favour_buyer) — split/dismissed/
    no_fault have no single party to penalise.
    """
    if outcome not in _OUTCOME_TO_BREACH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A forward-contract penalty needs a clear outcome (favour_farmer or favour_buyer).",
        )

    commitment = db.execute(
        select(ForwardCommitment).where(ForwardCommitment.deal_id == dispute.deal_id)
    ).scalar_one_or_none()
    if commitment is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This deal isn't linked to a forward-contract commitment.",
        )
    if commitment.status != "accepted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This commitment is '{commitment.status}' — it can't be marked breached.",
        )
    return commitment
