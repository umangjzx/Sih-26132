"""Public, no-login transparency dashboard data.

A statewide snapshot anyone (a farmer, a journalist, an MSInS analyst) can see
without an account: latest average modal price per crop, the biggest 7-day
movers, the modal-price trend across all crops, and headline platform activity.
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.deal import Deal
from app.models.demand import Demand
from app.models.dispute import Dispute
from app.models.lot import Lot
from app.models.price_cache import PriceCache

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/overview")
def public_overview(db: Session = Depends(get_db)) -> dict:
    latest_date = db.execute(
        select(func.max(PriceCache.date))
    ).scalar_one_or_none()
    if latest_date is None:
        return {"as_of": None, "crops": [], "gainers": [], "losers": [],
                "price_trend": [], "activity": {}}

    week_ago = latest_date - timedelta(days=7)

    # latest average modal price per crop
    latest_rows = db.execute(
        select(PriceCache.crop, func.avg(PriceCache.modal_price))
        .where(PriceCache.date == latest_date)
        .group_by(PriceCache.crop)
    ).all()
    # ~7-day-ago average per crop (nearest available date <= week_ago)
    prior_date = db.execute(
        select(func.max(PriceCache.date)).where(PriceCache.date <= week_ago)
    ).scalar_one_or_none()
    prior_rows = (
        db.execute(
            select(PriceCache.crop, func.avg(PriceCache.modal_price))
            .where(PriceCache.date == prior_date)
            .group_by(PriceCache.crop)
        ).all()
        if prior_date
        else []
    )
    prior_map = {c: float(p) for c, p in prior_rows}

    crops = []
    for crop, avg_modal in latest_rows:
        cur = round(float(avg_modal), 0)
        prev = prior_map.get(crop)
        change_pct = round((cur - prev) / prev * 100, 1) if prev else None
        crops.append({"crop": crop, "avg_modal_price": cur, "change_7d_pct": change_pct})

    movers = [c for c in crops if c["change_7d_pct"] is not None]
    gainers = sorted(movers, key=lambda c: c["change_7d_pct"], reverse=True)[:5]
    losers = sorted(movers, key=lambda c: c["change_7d_pct"])[:5]

    # 30-day statewide modal-price trend (avg across all crops/markets)
    since = latest_date - timedelta(days=30)
    day_col = func.date(PriceCache.date).label("day")
    trend = db.execute(
        select(day_col, func.avg(PriceCache.modal_price))
        .where(PriceCache.date >= since)
        .group_by(day_col)
        .order_by(day_col.asc())
    ).all()
    price_trend = [
        {"date": str(d), "avg_modal_price": round(float(v), 0)}
        for d, v in trend
        if v is not None
    ]

    activity = {
        "markets_reporting": db.execute(
            select(func.count(func.distinct(PriceCache.market))).where(PriceCache.date == latest_date)
        ).scalar_one(),
        "crops_tracked": len(crops),
        "open_lots": db.execute(
            select(func.count()).select_from(Lot).where(Lot.status == "open")
        ).scalar_one(),
        "open_demands": db.execute(
            select(func.count()).select_from(Demand).where(Demand.status == "open")
        ).scalar_one(),
        "total_deals": db.execute(select(func.count()).select_from(Deal)).scalar_one(),
        "open_disputes": db.execute(
            select(func.count()).select_from(Dispute).where(Dispute.status == "open")
        ).scalar_one(),
    }

    return {
        "as_of": latest_date.isoformat(),
        "crops": sorted(crops, key=lambda c: c["crop"]),
        "gainers": gainers,
        "losers": losers,
        "price_trend": price_trend,
        "activity": activity,
    }
