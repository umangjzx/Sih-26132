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
from app.schemas.deal import AdminDashboardResponse, DisputeSummary, PriceTrendPoint

router = APIRouter(tags=["admin"])

PRICE_TREND_DAYS = 30


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

    return AdminDashboardResponse(
        total_lots=total_lots,
        open_lots=open_lots,
        total_demands=total_demands,
        open_demands=open_demands,
        total_deals=total_deals,
        open_disputes_count=open_disputes_count,
        price_trend_summary=price_trend_summary,
        dispute_queue=dispute_queue,
    )
