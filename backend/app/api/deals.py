"""Deal pipeline endpoints (Phase 3, D-01..D-04 + Phase 2 roadmap).

- GET   /api/deals/mine              — deals for the current user.
- GET   /api/deals/{deal_id}         — single deal, farmer / buyer / admin only.
- PATCH /api/deals/{deal_id}/advance — advance pipeline_status one linear step.
- GET/PUT /api/deals/{deal_id}/logistics — logistics plan.
- GET   /api/deals/{deal_id}/events  — append-only audit log.
- GET/POST /api/deals/{deal_id}/payments — payment instalments + record new payment.
- GET   /api/deals/{deal_id}/receipt — printable plain-text receipt (HTML).
- GET   /api/transporters/nearby     — curated transporter directory.
"""

import html
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.api.matching import _counterparty, _demand_summary, _lot_summary
from app.core.config import settings
from app.core.database import get_db
from app.core.security import CurrentUser
from app.models.deal import Deal
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.logistics import DealLogistics
from app.models.match import Match
from app.models.payment import DealPayment
from app.models.user import User
from app.schemas.deal import DealDetailResponse
from app.schemas.logistics import LogisticsOut, LogisticsUpdate
from app.services.audit import get_deal_timeline, get_events_for, log_event


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
    log_event(db, actor_id=current_user.id, entity_type="deal", entity_id=deal.id,
              action=f"advance_to_{new_status}",
              detail={"from": PIPELINE_STAGES[idx], "method": body.payment_method,
                      "reference": body.payment_reference, "note": body.note})
    db.commit()
    db.refresh(deal)

    logger.info(
        "Deal %d advanced to '%s' by user %d (%s)",
        deal.id, new_status, current_user.id, current_user.role,
    )
    return _assemble_detail(deal, lot, demand, current_user, db)


# ---------------------------------------------------------------------------
# Per-deal logistics plan
# ---------------------------------------------------------------------------

def _pair_km_and_points(lot: Lot, demand: Demand) -> tuple[float | None, str, str]:
    from app.services.matching import pair_distance_km

    lot_c = (lot.latitude, lot.longitude) if lot.latitude is not None and lot.longitude is not None else None
    d_c = (demand.latitude, demand.longitude) if demand.latitude is not None and demand.longitude is not None else None
    km = pair_distance_km(lot.location, demand.delivery_district or "", lot_c, d_c)
    return km, (lot.location or ""), (demand.delivery_district or "")


def _est_cost(km: float | None, qty_kg: float) -> float | None:
    if km is None:
        return None
    return round(km * (qty_kg / 100.0) * settings.transport_cost_per_qtl_km, 0)


@router.get("/api/deals/{deal_id}/logistics", response_model=LogisticsOut)
def get_logistics(
    deal_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> LogisticsOut:
    deal, _m, lot, demand = _load_deal_with_access(deal_id, current_user, db)
    row = db.execute(
        select(DealLogistics).where(DealLogistics.deal_id == deal_id)
    ).scalar_one_or_none()
    km, pickup, drop = _pair_km_and_points(lot, demand)
    if row is not None:
        out = LogisticsOut.model_validate(row)
        out.distance_km = km if km is not None else out.distance_km
        return out
    # unsaved suggestion
    return LogisticsOut(
        deal_id=deal_id, mode="hired_transport", pickup_point=pickup, drop_point=drop,
        distance_km=km, est_cost_inr=_est_cost(km, deal.agreed_quantity),
        status="planned", is_draft=True,
    )


@router.put("/api/deals/{deal_id}/logistics", response_model=LogisticsOut)
def upsert_logistics(
    deal_id: int,
    body: LogisticsUpdate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> LogisticsOut:
    deal, _m, lot, demand = _load_deal_with_access(deal_id, current_user, db)
    if deal.pipeline_status == "closed":
        raise HTTPException(status.HTTP_409_CONFLICT, "This deal is closed.")

    km, pickup, drop = _pair_km_and_points(lot, demand)
    row = db.execute(
        select(DealLogistics).where(DealLogistics.deal_id == deal_id)
    ).scalar_one_or_none()
    if row is None:
        row = DealLogistics(deal_id=deal_id, pickup_point=pickup, drop_point=drop)
        db.add(row)

    data = body.cleaned()
    for field, value in data.items():
        setattr(row, field, value)
    row.distance_km = km
    if "est_cost_inr" not in data or data.get("est_cost_inr") is None:
        row.est_cost_inr = _est_cost(km, deal.agreed_quantity)

    db.commit()
    db.refresh(row)
    return LogisticsOut.model_validate(row)


# ---------------------------------------------------------------------------
# Audit log — GET /api/deals/{deal_id}/events
# ---------------------------------------------------------------------------

@router.get("/api/deals/{deal_id}/events")
def get_deal_events(
    deal_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return the full append-only audit log for a deal, oldest-first —
    its payment/logistics events plus the offer/match negotiation events."""
    deal, match, _lot, _demand = _load_deal_with_access(deal_id, current_user, db)
    return get_deal_timeline(db, deal_id, match.id if match else None)


# ---------------------------------------------------------------------------
# Payments — GET/POST /api/deals/{deal_id}/payments
# ---------------------------------------------------------------------------

class PaymentCreate(BaseModel):
    amount_inr: float = Field(gt=0)
    method: str = Field(default="UPI", max_length=30)
    reference: str | None = Field(default=None, max_length=160)
    note: str | None = Field(default=None, max_length=300)


class PaymentOut(BaseModel):
    id: int
    deal_id: int
    payer_id: int
    amount_inr: float
    method: str
    reference: str | None
    note: str | None
    paid_at: str


@router.get("/api/deals/{deal_id}/payments", response_model=list[PaymentOut])
def list_payments(
    deal_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> list[PaymentOut]:
    _load_deal_with_access(deal_id, current_user, db)
    rows = db.execute(
        select(DealPayment).where(DealPayment.deal_id == deal_id)
        .order_by(DealPayment.paid_at.asc())
    ).scalars().all()
    return [
        PaymentOut(
            id=r.id, deal_id=r.deal_id, payer_id=r.payer_id,
            amount_inr=r.amount_inr, method=r.method,
            reference=r.reference, note=r.note,
            paid_at=r.paid_at.isoformat(),
        )
        for r in rows
    ]


@router.post("/api/deals/{deal_id}/payments", response_model=PaymentOut, status_code=201)
def record_payment(
    deal_id: int,
    body: PaymentCreate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> PaymentOut:
    """Record a payment instalment. Buyer role only (or admin).
    When the sum of payments reaches the agreed deal value, deal.payment_status
    is automatically set to 'paid'.
    """
    deal, _m, lot, demand = _load_deal_with_access(deal_id, current_user, db)
    if current_user.role not in ("buyer", "admin") and current_user.id != demand.buyer_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the buyer can record a payment")

    row = DealPayment(
        deal_id=deal_id,
        payer_id=current_user.id,
        amount_inr=body.amount_inr,
        method=body.method,
        reference=body.reference,
        note=body.note,
    )
    db.add(row)

    # auto-mark deal as paid if total payments >= agreed value
    total_paid = float(
        db.execute(
            select(func.coalesce(func.sum(DealPayment.amount_inr), 0.0))
            .where(DealPayment.deal_id == deal_id)
        ).scalar_one()
    ) + body.amount_inr
    agreed_value = deal.agreed_price * deal.agreed_quantity / 100.0
    if total_paid >= agreed_value * 0.999:  # 0.1% tolerance for float rounding
        deal.payment_status = "paid"

    log_event(db, actor_id=current_user.id, entity_type="payment", entity_id=deal_id,
              action="payment_recorded",
              detail={"amount_inr": body.amount_inr, "method": body.method,
                      "reference": body.reference, "total_so_far": round(total_paid, 2)})
    db.commit()
    db.refresh(row)
    return PaymentOut(
        id=row.id, deal_id=row.deal_id, payer_id=row.payer_id,
        amount_inr=row.amount_inr, method=row.method,
        reference=row.reference, note=row.note,
        paid_at=row.paid_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Printable receipt — GET /api/deals/{deal_id}/receipt
# ---------------------------------------------------------------------------

@router.get("/api/deals/{deal_id}/receipt", response_class=HTMLResponse)
def get_receipt(
    deal_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> HTMLResponse:
    """Return a minimal printable HTML receipt / contract for a deal."""
    deal, match, lot, demand = _load_deal_with_access(deal_id, current_user, db)

    farmer = db.get(User, lot.farmer_id)
    buyer = db.get(User, demand.buyer_id)
    logistics = db.execute(
        select(DealLogistics).where(DealLogistics.deal_id == deal_id)
    ).scalar_one_or_none()
    payments = db.execute(
        select(DealPayment).where(DealPayment.deal_id == deal_id)
        .order_by(DealPayment.paid_at.asc())
    ).scalars().all()
    total_paid = sum(p.amount_inr for p in payments)
    agreed_value = round(deal.agreed_price * deal.agreed_quantity / 100.0, 2)

    def esc(v: object) -> str:
        s = "" if v is None else str(v)
        return html.escape(s) if s else "—"

    def _name(u: User | None) -> str:
        return esc(u.name) if u else "—"

    def _phone(u: User | None) -> str:
        return esc(u.phone) if u else "—"

    def _title(v: str | None) -> str:
        return esc((v or "").replace("_", " ").title()) if v else "—"

    payment_rows = "".join(
        f"<tr><td>{p.paid_at.strftime('%d %b %Y %H:%M') if p.paid_at else '—'}</td>"
        f"<td>₹{p.amount_inr:,.2f}</td><td>{esc(p.method)}</td>"
        f"<td>{esc(p.reference)}</td></tr>"
        for p in payments
    )

    # Logistics block — prefer the DealLogistics detail row, fall back to the
    # deal's coarse logistics_mode.
    lg_mode = _title(logistics.mode if logistics else deal.logistics_mode)
    lg_transporter = esc(logistics.transporter_name) if logistics else "—"
    lg_tphone = esc(logistics.transporter_phone) if logistics else "—"
    lg_vehicle = _title(logistics.vehicle_type) if logistics else "—"
    lg_pickup_date = (
        logistics.pickup_date.strftime("%d %b %Y")
        if logistics and logistics.pickup_date else "—"
    )
    lg_pickup = esc(logistics.pickup_point if logistics and logistics.pickup_point else lot.location)
    lg_drop = esc(logistics.drop_point if logistics and logistics.drop_point else demand.delivery_district)
    lg_distance = f"{logistics.distance_km:,.0f} km" if logistics and logistics.distance_km is not None else "—"
    lg_cost = f"₹{logistics.est_cost_inr:,.0f}" if logistics and logistics.est_cost_inr is not None else "—"
    lg_status = _title(logistics.status if logistics else None)

    # Pipeline-level payment confirmation (recorded when the deal was marked paid).
    confirmed_row = (
        f"<tr class='highlight'><td>Confirmed payment</td>"
        f"<td>{_title(deal.payment_method)} · ref {esc(deal.payment_reference)}</td></tr>"
        if deal.payment_reference else ""
    )

    doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AgriLink Deal Receipt — #{deal.id}</title>
<style>
  body {{ font-family: Arial, sans-serif; font-size: 13px; color: #1c2128; max-width: 680px; margin: 24px auto; padding: 0 16px; }}
  h1 {{ font-size: 20px; margin-bottom: 2px; }}
  .sub {{ color: #57606a; margin-bottom: 16px; font-size: 11px; }}
  table {{ width: 100%; border-collapse: collapse; margin-bottom: 16px; }}
  th {{ background: #1a4d2e; color: #fff; text-align: left; padding: 6px 8px; font-size: 11px; }}
  td {{ padding: 6px 8px; border-bottom: 1px solid #d0d7de; }}
  .highlight {{ background: #d8f3dc; font-weight: bold; }}
  .footer {{ margin-top: 24px; font-size: 11px; color: #57606a; border-top: 1px solid #d0d7de; padding-top: 8px; }}
  @media print {{ .no-print {{ display: none; }} }}
</style>
</head>
<body>
<h1>AgriLink — Deal Receipt</h1>
<div class="sub">Deal #{deal.id} · Generated {datetime.now().strftime('%d %b %Y %H:%M')} IST</div>

<table>
  <tr><th colspan="2">Crop & Trade Terms</th></tr>
  <tr><td>Crop</td><td><b>{esc(lot.crop)}</b></td></tr>
  <tr><td>Quality grade</td><td>{esc(lot.quality_grade)}</td></tr>
  <tr><td>Agreed quantity</td><td>{deal.agreed_quantity:,.0f} kg</td></tr>
  <tr><td>Agreed price</td><td>₹{deal.agreed_price:,.0f} / quintal</td></tr>
  <tr class="highlight"><td>Total deal value</td><td>₹{agreed_value:,.2f}</td></tr>
  <tr><td>Pipeline status</td><td>{_title(deal.pipeline_status)}</td></tr>
  <tr><td>Payment status</td><td>{_title(deal.payment_status)}</td></tr>
  {confirmed_row}
</table>

<table>
  <tr><th>Role</th><th>Name</th><th>Phone</th><th>District</th></tr>
  <tr><td>Seller (Farmer)</td><td>{_name(farmer)}</td><td>{_phone(farmer)}</td><td>{esc(farmer.district) if farmer else '—'}</td></tr>
  <tr><td>Buyer</td><td>{_name(buyer)}</td><td>{_phone(buyer)}</td><td>{esc(buyer.district) if buyer else '—'}</td></tr>
</table>

<table>
  <tr><th colspan="2">Logistics</th></tr>
  <tr><td>Mode</td><td>{lg_mode}</td></tr>
  <tr><td>Transporter</td><td>{lg_transporter}{f" · {lg_tphone}" if lg_tphone != "—" else ""}</td></tr>
  <tr><td>Vehicle</td><td>{lg_vehicle}</td></tr>
  <tr><td>Route</td><td>{lg_pickup} → {lg_drop}</td></tr>
  <tr><td>Pickup date</td><td>{lg_pickup_date}</td></tr>
  <tr><td>Distance / est. cost</td><td>{lg_distance} · {lg_cost}</td></tr>
  <tr><td>Logistics status</td><td>{lg_status}</td></tr>
</table>

{"<table><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th></tr>" + payment_rows + f"<tr class='highlight'><td colspan='2'><b>Total paid: ₹{total_paid:,.2f}</b></td><td colspan='2'>Outstanding: ₹{max(0, agreed_value - total_paid):,.2f}</td></tr></table>" if payments else "<p><i>No payment records yet.</i></p>"}

<div class="footer">
  This receipt is an AgriLink platform record only. It is not a legally enforceable
  contract. Both parties should retain signed paper documentation.
  AgriLink · SIH 2026 · PS-26132
</div>

<p class="no-print" style="margin-top:16px">
  <button onclick="window.print()">🖨 Print / Save as PDF</button>
</p>
</body>
</html>"""
    return HTMLResponse(content=doc)


# ---------------------------------------------------------------------------
# Transporter directory — GET /api/transporters/nearby
# ---------------------------------------------------------------------------

@router.get("/api/transporters/nearby")
def nearby_transporters(
    district: str | None = Query(None),
    state: str | None = Query(None),
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    max_km: float = Query(300.0, ge=1, le=2000),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return nearby transporters sorted by distance. No auth required."""
    from app.services.transporters import nearby_transporters as _nb
    return _nb(db, lat=lat, lon=lon, district=district, state=state,
               max_km=max_km, limit=limit)
