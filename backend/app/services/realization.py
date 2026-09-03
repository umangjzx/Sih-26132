"""Price-realisation tracker (v1.6 #1).

Proves the platform's core promise: did an AgriLink linkage actually get the
farmer a better price than the open mandi? For every deal the farmer struck,
compare the locked price against two benchmarks around the deal date:

  * the mandi modal price for that crop (AGMARKNET, same state where known),
  * the crop's MSP, if it is a notified crop.

Everything is derived from data already stored — closed deals, ``PriceCache``
and the curated MSP table — so there is no new model or migration.
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.deal import Deal
from app.models.lot import Lot
from app.models.match import Match
from app.models.price_cache import PriceCache
from app.models.user import User
from app.services import reference as ref

# pipeline stages at which the price is locked and produce has moved / paid
_COMPLETED = {"delivered", "paid", "closed"}
_NEAR_DAYS = 10
_WIDE_DAYS = 30


def _mandi_benchmark(
    db: Session,
    crop: str,
    on_date,
    state: str | None,
    _memo: dict | None = None,
) -> tuple[float | None, str]:
    """Average modal price for ``crop`` within a window around ``on_date``.
    Prefers the farmer's state, widens the date window before dropping the
    state filter. Returns (price, basis-label).

    Crop and state are matched case-insensitively so a lot typed 'onion' still
    benchmarks against AGMARKNET's 'Onion' rows. ``_memo`` (optional) caches the
    result per (crop, date, state) across the many deals in one report."""
    key = (crop.strip().lower(), on_date, (state or "").strip().lower())
    if _memo is not None and key in _memo:
        return _memo[key]

    crop_norm = crop.strip()
    result: tuple[float | None, str] = (None, "no data")
    for days, scope in ((_NEAR_DAYS, "state"), (_WIDE_DAYS, "state"),
                        (_NEAR_DAYS, "all"), (_WIDE_DAYS, "all")):
        stmt = select(func.avg(PriceCache.modal_price)).where(
            PriceCache.crop.ilike(crop_norm),
            PriceCache.date >= on_date - timedelta(days=days),
            PriceCache.date <= on_date + timedelta(days=days),
        )
        if scope == "state" and state:
            stmt = stmt.where(PriceCache.state.ilike(state.strip()))
        elif scope == "state":
            continue  # no state to filter on — skip to the "all" passes
        val = db.execute(stmt).scalar_one_or_none()
        if val is not None:
            label = f"±{days}d" + (f", {state}" if scope == "state" and state else ", all-India")
            result = (round(float(val), 0), label)
            break

    if _memo is not None:
        _memo[key] = result
    return result


def farmer_realization(db: Session, farmer_id: int) -> dict:
    """Per-deal realised price vs mandi & MSP for one farmer, plus a
    volume-weighted summary."""
    farmer = db.get(User, farmer_id)
    state = (farmer.state or None) if farmer else None

    rows = db.execute(
        select(Deal, Lot)
        .join(Match, Deal.match_id == Match.id)
        .join(Lot, Match.lot_id == Lot.id)
        .where(Lot.farmer_id == farmer_id)
        .order_by(Deal.created_at.asc(), Deal.id.asc())
    ).all()

    deals: list[dict] = []
    tot_qty = tot_value = 0.0
    w_realized_num = w_mandi_num = w_mandi_qty = 0.0
    below_msp_count = 0
    bench_memo: dict = {}

    for deal, lot in rows:
        on_date = deal.created_at.date()
        realized = round(float(deal.agreed_price), 0)          # ₹/quintal
        qty_kg = float(deal.agreed_quantity)
        value = round(realized * qty_kg / 100.0, 0)
        completed = deal.pipeline_status in _COMPLETED

        mandi, basis = _mandi_benchmark(db, lot.crop, on_date, state, bench_memo)
        msp_entry = ref.msp_for(lot.crop)
        msp = float(msp_entry["price"]) if msp_entry else None

        vs_mandi_pct = (
            round((realized - mandi) / mandi * 100, 1) if mandi else None
        )
        vs_msp_pct = round((realized - msp) / msp * 100, 1) if msp else None
        if msp is not None and realized < msp:
            below_msp_count += 1

        deals.append({
            "deal_id": deal.id,
            "crop": lot.crop,
            "date": on_date.isoformat(),
            "quantity_kg": qty_kg,
            "realized_per_qtl": realized,
            "value_inr": value,
            "mandi_benchmark_per_qtl": mandi,
            "mandi_basis": basis,
            "msp_per_qtl": msp,
            "vs_mandi_pct": vs_mandi_pct,
            "vs_msp_pct": vs_msp_pct,
            "pipeline_status": deal.pipeline_status,
            "completed": completed,
        })

        if completed:
            tot_qty += qty_kg
            tot_value += value
            w_realized_num += realized * qty_kg
            if mandi:
                w_mandi_num += mandi * qty_kg
                w_mandi_qty += qty_kg

    w_realized = round(w_realized_num / tot_qty, 0) if tot_qty else None
    w_mandi = round(w_mandi_num / w_mandi_qty, 0) if w_mandi_qty else None
    uplift_pct = (
        round((w_realized - w_mandi) / w_mandi * 100, 1)
        if w_realized and w_mandi else None
    )
    benchmarked = [d for d in deals if d["completed"] and d["vs_mandi_pct"] is not None]
    best = max(benchmarked, key=lambda d: d["vs_mandi_pct"], default=None)

    return {
        "farmer_id": farmer_id,
        "state": state,
        "summary": {
            "deals_total": len(deals),
            "deals_completed": sum(1 for d in deals if d["completed"]),
            "total_quantity_kg": round(tot_qty, 0),
            "total_value_inr": round(tot_value, 0),
            "weighted_realized_per_qtl": w_realized,
            "weighted_mandi_per_qtl": w_mandi,
            "uplift_vs_mandi_pct": uplift_pct,
            "below_msp_deals": below_msp_count,
            "best_deal": (
                {"deal_id": best["deal_id"], "crop": best["crop"],
                 "vs_mandi_pct": best["vs_mandi_pct"]}
                if best else None
            ),
        },
        "deals": deals,
    }
