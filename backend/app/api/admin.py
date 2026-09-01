"""Read-only admin oversight dashboard (Phase 3, D-09).

GET /api/admin/dashboard — admin-only. Aggregate counts, the open-dispute queue,
and a 30-day average-modal-price series across all crops (reused from PriceCache).
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.demand import Demand
from app.models.dispute import Dispute
from app.models.lot import Lot
from app.models.deal import Deal
from app.models.price_cache import PriceCache
from app.models.user import User
from app.schemas.deal import (
    AdminDashboardResponse,
    DisputeSummary,
    DistrictPriceGap,
    PriceAnomaly,
    PriceTrendPoint,
)

router = APIRouter(tags=["admin"])

PRICE_TREND_DAYS = 30
ANOMALY_PCT = 20.0


@router.get("/api/admin/dashboard", response_model=AdminDashboardResponse)
def admin_dashboard(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    _admin: User = require_role("admin"),
) -> AdminDashboardResponse:
    def _count(model, *where) -> int:
        stmt = select(func.count()).select_from(model)
        for clause in where:
            stmt = stmt.where(clause)
        return int(db.execute(stmt).scalar_one() or 0)

    total_lots = _count(Lot)
    open_lots = _count(Lot, Lot.status == "open")
    total_demands = _count(Demand)
    open_demands = _count(Demand, Demand.status == "open")
    total_deals = _count(Deal)
    open_disputes_count = _count(Dispute, Dispute.status == "open")

    # 30-day average modal price across all crops
    since = date.today() - timedelta(days=PRICE_TREND_DAYS)
    day_col = func.date(PriceCache.date).label("day")
    trend_rows = db.execute(
        select(day_col, func.avg(PriceCache.modal_price).label("avg_price"))
        .where(PriceCache.date >= since)
        .group_by(day_col)
        .order_by(day_col.asc())
    ).all()
    price_trend_summary = [
        PriceTrendPoint(date=str(day), avg_modal_price=round(float(avg_price), 2))
        for day, avg_price in trend_rows
        if avg_price is not None
    ]

    dispute_rows = db.execute(
        select(Dispute)
        .where(Dispute.status == "open")
        .order_by(Dispute.created_at.desc(), Dispute.id.desc())
    ).scalars().all()
    dispute_queue = [DisputeSummary.model_validate(d) for d in dispute_rows]

    # --- v1.1: district price-realisation gap (latest reported date) ---
    latest_date = db.execute(select(func.max(PriceCache.date))).scalar_one_or_none()
    district_price_gaps: list[DistrictPriceGap] = []
    if latest_date is not None:
        rows = db.execute(
            select(PriceCache.district, func.avg(PriceCache.modal_price))
            .where(PriceCache.date == latest_date, PriceCache.district != "")
            .group_by(PriceCache.district)
        ).all()
        if rows:
            state_avg = sum(float(a) for _, a in rows) / len(rows)
            for district, avg in rows:
                avg = float(avg)
                gap = round((avg - state_avg) / state_avg * 100, 1) if state_avg else 0.0
                district_price_gaps.append(
                    DistrictPriceGap(district=district, avg_modal_price=round(avg, 0), gap_vs_state_pct=gap)
                )
            district_price_gaps.sort(key=lambda x: x.gap_vs_state_pct)

    # --- v1.1: disputes by the raiser's district ---
    dby_rows = db.execute(
        select(User.district, func.count())
        .join(Dispute, Dispute.raised_by == User.id)
        .group_by(User.district)
    ).all()
    disputes_by_district = {d or "Unknown": int(n) for d, n in dby_rows}

    # --- v1.1: price anomalies (latest modal vs its own trailing 7-day avg) ---
    price_anomalies: list[PriceAnomaly] = []
    if latest_date is not None:
        since7 = latest_date - timedelta(days=8)
        avg_rows = db.execute(
            select(
                PriceCache.crop,
                PriceCache.market,
                func.avg(PriceCache.modal_price).label("avg7"),
            )
            .where(PriceCache.date >= since7, PriceCache.date < latest_date)
            .group_by(PriceCache.crop, PriceCache.market)
        ).all()
        avg_map = {(c, m): float(a) for c, m, a in avg_rows}
        latest_rows = db.execute(
            select(PriceCache.crop, PriceCache.market, PriceCache.modal_price)
            .where(PriceCache.date == latest_date)
        ).all()
        for crop, market, modal in latest_rows:
            base = avg_map.get((crop, market))
            if not base:
                continue
            dev = (float(modal) - base) / base * 100
            if abs(dev) >= ANOMALY_PCT:
                price_anomalies.append(
                    PriceAnomaly(
                        crop=crop, market=market,
                        modal_price=round(float(modal), 0),
                        avg_7d=round(base, 0),
                        deviation_pct=round(dev, 1),
                    )
                )
        price_anomalies.sort(key=lambda x: abs(x.deviation_pct), reverse=True)
        price_anomalies = price_anomalies[:15]

    return AdminDashboardResponse(
        total_lots=total_lots,
        open_lots=open_lots,
        total_demands=total_demands,
        open_demands=open_demands,
        total_deals=total_deals,
        open_disputes_count=open_disputes_count,
        price_trend_summary=price_trend_summary,
        dispute_queue=dispute_queue,
        district_price_gaps=district_price_gaps,
        disputes_by_district=disputes_by_district,
        price_anomalies=price_anomalies,
    )
