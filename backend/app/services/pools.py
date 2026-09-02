"""Pool aggregation + buyer-demand matching.

A locked/open pool behaves like one virtual lot:
  quantity        = sum of committed members' quantity_kg
  asking price    = quantity-weighted mean of members' expected_price,
                    floored at the pool's floor_price
It is then scored against open buyer demands with the same rule-based
``score_pair`` the 1:1 matcher uses, so pool matches are explained the same way.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.demand import Demand
from app.models.pool import Pool, PoolMember
from app.models.user import User
from app.services.matching import MIN_SCORE, score_pair, score_tier


def aggregate(pool: Pool, members: list[PoolMember]) -> dict:
    """Roll the committed members up into the pool's negotiating position."""
    committed = [m for m in members if m.status == "committed"]
    qty = round(sum(m.quantity_kg for m in committed), 2)
    if qty > 0:
        weighted = sum(m.quantity_kg * m.expected_price for m in committed) / qty
    else:
        weighted = pool.floor_price
    effective_price = round(max(weighted, pool.floor_price), 2)
    return {
        "members": len(committed),
        "quantity_kg": qty,
        "weighted_price": round(weighted, 2),
        "floor_price": round(pool.floor_price, 2),
        "effective_price": effective_price,
        "fill_pct": round(100 * qty / pool.target_quantity_kg, 1) if pool.target_quantity_kg else 0.0,
        "target_quantity_kg": round(pool.target_quantity_kg, 2),
    }


def demand_candidates(db: Session, pool: Pool, members: list[PoolMember], *, limit: int = 8) -> list[dict]:
    """Rank open buyer demands for the same crop against the aggregated pool."""
    agg = aggregate(pool, members)
    if agg["quantity_kg"] <= 0:
        return []

    rows = db.execute(
        select(Demand, User)
        .join(User, Demand.buyer_id == User.id)
        .where(Demand.status == "open")
    ).all()

    out: list[dict] = []
    for demand, buyer in rows:
        if demand.crop.strip().lower() != pool.crop.strip().lower():
            continue
        total, detail = score_pair(
            lot_qty=agg["quantity_kg"],
            lot_expected_price=agg["effective_price"],
            lot_location=pool.location or "",
            demand_qty=demand.quantity_kg,
            demand_band_min=demand.price_band_min,
            demand_band_max=demand.price_band_max,
            buyer_district=buyer.district or "",
            lot_coords=(pool.latitude, pool.longitude)
            if pool.latitude is not None and pool.longitude is not None
            else None,
            lot_grade=pool.grade or "",
            demand_quality_spec=demand.quality_grade_min or demand.quality_spec or "",
            demand_delivery_window=demand.delivery_window or "",
        )
        if total < MIN_SCORE:
            continue
        out.append({
            "demand_id": demand.id,
            "buyer_name": buyer.name,
            "buyer_district": buyer.district,
            "buyer_kyc": buyer.kyc_status,
            "quantity_kg": demand.quantity_kg,
            "price_band_min": demand.price_band_min,
            "price_band_max": demand.price_band_max,
            "delivery_window": demand.delivery_window,
            "score": total,
            "tier": score_tier(total),
            "score_detail": detail,
        })
    out.sort(key=lambda d: d["score"], reverse=True)
    return out[:limit]
