"""Warehouse-receipt-backed financing requests (v1.17).

A farmer cites one of their own stored lots as collateral and asks for a cash
advance against it; an admin reviews and approves/rejects — the same
self-reported, admin-manual pattern as account verification
(POST /auth/me/request-verification + PATCH /admin/users/{id}/verify). The
platform holds no money and disburses nothing: this tracks the *request* and
its outcome, not an actual loan. Real disbursement needs a licensed bank/NBFC
partner (see README's Known Limitations).
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import ratelimit
from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.financing import FinancingRequest
from app.models.lot import Lot
from app.models.notification import Notification
from app.models.user import User
from app.schemas.financing import (
    FinancingRequestCreate,
    FinancingRequestOut,
    FinancingRequestReview,
)
from app.services.audit import log_event

router = APIRouter(prefix="/api/financing", tags=["financing"])
logger = logging.getLogger(__name__)

_IST = ZoneInfo("Asia/Kolkata")

# Typical WDRA / NABARD pledge-finance loan-to-value ratio — a cash advance
# against stored produce is conventionally capped well below full market
# value so a price dip before repayment doesn't leave the advance unsecured.
_LOAN_TO_VALUE = 0.75

_ACTIVE_STATUSES = ("pending", "approved")

_CREATE_LIMIT, _CREATE_WINDOW_S = 10, 3600


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _max_eligible(lot: Lot) -> float:
    return round(lot.expected_price / 100 * lot.quantity_kg * _LOAN_TO_VALUE, 0)


def _enrich(db: Session, r: FinancingRequest, lot: Lot | None = None, farmer: User | None = None) -> FinancingRequestOut:
    lot = lot or db.get(Lot, r.lot_id)
    farmer = farmer or db.get(User, r.farmer_id)
    out = FinancingRequestOut.model_validate(r)
    if lot:
        out.crop = lot.crop
        out.max_eligible_inr = _max_eligible(lot)
    if farmer:
        out.farmer_name = farmer.name
    return out


@router.post("/requests", response_model=FinancingRequestOut, status_code=status.HTTP_201_CREATED)
def create_request(
    body: FinancingRequestCreate,
    request: Request,
    current_user: CurrentUser,
    _role: User = require_role("farmer"),
    db: Session = Depends(get_db),
) -> FinancingRequestOut:
    if not ratelimit.check(f"financing_create:{_client_ip(request)}",
                           limit=_CREATE_LIMIT, window_s=_CREATE_WINDOW_S):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Too many requests — please try again later.")

    lot = db.get(Lot, body.lot_id)
    if lot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lot not found")
    if lot.farmer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only pledge your own lot")
    if lot.status != "open":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This lot is '{lot.status}' — only an open (unsold) lot can be pledged as collateral",
        )

    existing = db.execute(
        select(FinancingRequest).where(
            FinancingRequest.lot_id == body.lot_id,
            FinancingRequest.status.in_(_ACTIVE_STATUSES),
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This lot already has an active financing request — withdraw it first to request again",
        )

    cap = _max_eligible(lot)
    if body.requested_amount_inr > cap:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Requested amount exceeds {_LOAN_TO_VALUE:.0%} of this lot's estimated value "
            f"(max ₹{cap:.0f} against {lot.quantity_kg / 100:.0f} qtl of {lot.crop})",
        )

    r = FinancingRequest(
        farmer_id=current_user.id,
        lot_id=lot.id,
        requested_amount_inr=body.requested_amount_inr,
        warehouse_name=body.warehouse_name,
        receipt_ref=body.receipt_ref,
        note=body.note,
        status="pending",
    )
    db.add(r)
    try:
        db.flush()
    except IntegrityError:
        # Two near-simultaneous requests for the same lot (double-submit,
        # multi-tab) both passed the `existing` check above — the
        # uq_financing_request_active_per_lot constraint catches what the
        # read missed, before this lot could ever be pledged twice.
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This lot already has an active financing request — withdraw it first to request again",
        )
    log_event(
        db, actor_id=current_user.id, entity_type="financing_request", entity_id=r.id,
        action="financing_requested",
        detail={"lot_id": lot.id, "crop": lot.crop, "requested_amount_inr": r.requested_amount_inr},
    )
    db.commit()
    db.refresh(r)
    logger.info("Financing request %d created by farmer %d for lot %d", r.id, current_user.id, lot.id)
    return _enrich(db, r, lot=lot, farmer=current_user)


@router.get("/requests/mine", response_model=list[FinancingRequestOut])
def list_mine(
    current_user: CurrentUser,
    _role: User = require_role("farmer"),
    db: Session = Depends(get_db),
) -> list[FinancingRequestOut]:
    rows = db.execute(
        select(FinancingRequest)
        .where(FinancingRequest.farmer_id == current_user.id)
        .order_by(FinancingRequest.created_at.desc())
    ).scalars().all()
    return [_enrich(db, r, farmer=current_user) for r in rows]


@router.post("/requests/{request_id}/withdraw", response_model=FinancingRequestOut)
def withdraw_request(
    request_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> FinancingRequestOut:
    r = db.get(FinancingRequest, request_id)
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Financing request not found")
    if r.farmer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only withdraw your own request")
    if r.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Request is '{r.status}', not pending")

    # Atomic claim — an admin's review() could be committing at the same
    # instant; whichever write loses the race gets rowcount 0 instead of
    # silently overwriting the other's outcome.
    claimed = db.execute(
        update(FinancingRequest)
        .where(FinancingRequest.id == r.id, FinancingRequest.status == "pending")
        .values(status="withdrawn")
    ).rowcount
    if not claimed:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "This request was just reviewed — refresh and try again.")
    db.refresh(r)
    db.flush()
    log_event(db, actor_id=current_user.id, entity_type="financing_request", entity_id=r.id,
              action="financing_withdrawn", detail={})
    db.commit()
    db.refresh(r)
    return _enrich(db, r, farmer=current_user)


@router.get("/requests", response_model=list[FinancingRequestOut])
def list_all(
    _admin: User = require_role("admin"),
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
) -> list[FinancingRequestOut]:
    stmt = select(FinancingRequest).order_by(FinancingRequest.created_at.desc())
    if status_filter:
        stmt = stmt.where(FinancingRequest.status == status_filter)
    rows = db.execute(stmt).scalars().all()
    return [_enrich(db, r) for r in rows]


@router.patch("/requests/{request_id}", response_model=FinancingRequestOut)
def review_request(
    request_id: int,
    body: FinancingRequestReview,
    current_user: CurrentUser,
    _admin: User = require_role("admin"),
    db: Session = Depends(get_db),
) -> FinancingRequestOut:
    r = db.get(FinancingRequest, request_id)
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Financing request not found")
    if r.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Request is already '{r.status}'")

    lot = db.get(Lot, r.lot_id)

    # Re-validate against the lot's CURRENT value before approving — nothing
    # stops the farmer from editing an open lot's price/quantity while a
    # request against it is still pending, so the cap checked at creation
    # time may now be stale. Validated (and may raise) before anything is
    # mutated, same as _validate_forward_penalty in disputes.py.
    if body.status == "approved" and lot is not None:
        cap = _max_eligible(lot)
        if r.requested_amount_inr > cap:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"This lot's value has changed since the request was made — the requested "
                f"₹{r.requested_amount_inr:.0f} now exceeds the {_LOAN_TO_VALUE:.0%} cap "
                f"(₹{cap:.0f}). Reject this request, or ask the farmer to resubmit at a valid amount.",
            )

    # Atomic claim — see withdraw_request's comment; a farmer's withdraw()
    # could be racing this same instant.
    claimed = db.execute(
        update(FinancingRequest)
        .where(FinancingRequest.id == r.id, FinancingRequest.status == "pending")
        .values(status=body.status)
    ).rowcount
    if not claimed:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "This request was just withdrawn — refresh and try again.")
    db.refresh(r)

    r.admin_note = body.admin_note
    r.reviewed_by = current_user.id
    r.reviewed_at = datetime.now(_IST)
    db.flush()
    log_event(
        db, actor_id=current_user.id, entity_type="financing_request", entity_id=r.id,
        action="financing_reviewed", detail={"status": r.status},
    )
    crop = lot.crop if lot else "your lot"
    db.add(Notification(
        user_id=r.farmer_id,
        kind="deal",
        title=f"Financing request for {crop} {r.status}",
        body=r.admin_note or "",
        link="/financing",
    ))
    db.commit()
    db.refresh(r)
    logger.info("Financing request %d %s by admin %d", r.id, r.status, current_user.id)
    return _enrich(db, r)
