"""Read-only admin oversight dashboard (Phase 3, D-09).

GET /api/admin/dashboard — admin-only. Aggregate counts, the open-dispute queue,
and a 30-day average-modal-price series across all crops (reused from PriceCache).
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.demand import Demand
from app.models.dispute import Dispute
from app.models.lot import Lot
from app.models.deal import Deal
from app.models.match import Match
from app.models.offer import Offer
from app.models.price_cache import PriceCache
from app.models.user import User
from app.schemas.deal import (
    AdminAnalyticsResponse,
    AdminDashboardResponse,
    CropSupplyDemand,
    DisputeSummary,
    DistrictPriceGap,
    FunnelStage,
    PriceAnomaly,
    PricePulse,
    PriceTrendPoint,
    ScoreBucket,
    WeeklyPoint,
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


@router.get("/api/admin/matching-health")
def admin_matching_health(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    _admin: User = require_role("admin"),
) -> dict:
    """Re-derives every live match from the current lots/demands and reports how
    many still hold up — so match quality is measured, not assumed."""
    from app.services.matching import matching_health

    return matching_health(db)


@router.get("/api/admin/analytics", response_model=AdminAnalyticsResponse)
def admin_analytics(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    _admin: User = require_role("admin"),
) -> AdminAnalyticsResponse:
    """Chart-ready aggregates for the admin dashboard. Everything here is derived
    from tables the platform already fills — no new data collection."""

    def _scalar(stmt) -> float:
        return float(db.execute(stmt).scalar_one() or 0)

    # ---- headline KPIs -------------------------------------------------------
    n_lots = int(_scalar(select(func.count()).select_from(Lot)))
    n_demands = int(_scalar(select(func.count()).select_from(Demand)))
    n_matches = int(_scalar(select(func.count()).select_from(Match)))
    n_offers = int(_scalar(select(func.count()).select_from(Offer)))
    n_deals = int(_scalar(select(func.count()).select_from(Deal)))
    n_closed = int(_scalar(
        select(func.count()).select_from(Deal).where(Deal.pipeline_status == "closed")
    ))

    # GMV: agreed_price is ₹/quintal, agreed_quantity is kg → ₹ = price × qty / 100
    gmv = _scalar(select(func.coalesce(func.sum(Deal.agreed_price * Deal.agreed_quantity / 100.0), 0.0)))
    avg_deal = round(gmv / n_deals, 2) if n_deals else 0.0

    role_rows = db.execute(select(User.role, func.count()).group_by(User.role)).all()
    users_by_role = {r or "unknown": int(n) for r, n in role_rows}
    users_total = sum(users_by_role.values())

    markets_tracked = int(_scalar(select(func.count(func.distinct(PriceCache.market)))))
    districts_tracked = int(_scalar(
        select(func.count(func.distinct(PriceCache.district))).where(PriceCache.district != "")
    ))
    states_tracked = int(_scalar(
        select(func.count(func.distinct(PriceCache.state))).where(PriceCache.state != "")
    ))

    latest_date = db.execute(select(func.max(PriceCache.date))).scalar_one_or_none()
    price_index_latest = 0.0
    price_index_change = 0.0
    if latest_date is not None:
        price_index_latest = _scalar(
            select(func.avg(PriceCache.modal_price)).where(PriceCache.date == latest_date)
        )
        prior = latest_date - timedelta(days=30)
        prior_avg = _scalar(
            select(func.avg(PriceCache.modal_price)).where(
                PriceCache.date <= prior, PriceCache.date >= prior - timedelta(days=3)
            )
        )
        if prior_avg:
            price_index_change = round((price_index_latest - prior_avg) / prior_avg * 100, 1)

    match_conversion = round(n_deals / n_matches * 100, 1) if n_matches else 0.0

    # ---- marketplace funnel ----------------------------------------------------
    funnel = [
        FunnelStage(stage="Listings", count=n_lots + n_demands),
        FunnelStage(stage="Matches", count=n_matches),
        FunnelStage(stage="Offers", count=n_offers),
        FunnelStage(stage="Deals", count=n_deals),
        FunnelStage(stage="Closed", count=n_closed),
    ]

    # ---- deal pipeline breakdown --------------------------------------------
    pipe_order = ["matched", "offer_accepted", "logistics_arranged", "delivered", "paid", "closed"]
    pipe_rows = db.execute(
        select(Deal.pipeline_status, func.count()).group_by(Deal.pipeline_status)
    ).all()
    pipe_map = {s: int(n) for s, n in pipe_rows}
    deal_pipeline = {s: pipe_map.get(s, 0) for s in pipe_order}

    # ---- supply vs demand by crop ----------------------------------------------
    sup_rows = db.execute(
        select(
            Lot.crop,
            func.sum(Lot.quantity_kg),
            func.count(),
        ).where(Lot.status == "open").group_by(Lot.crop)
    ).all()
    dem_rows = db.execute(
        select(
            Demand.crop,
            func.sum(Demand.quantity_kg),
            func.count(),
        ).where(Demand.status == "open").group_by(Demand.crop)
    ).all()
    sup = {c: (float(q or 0), int(n)) for c, q, n in sup_rows}
    dem = {c: (float(q or 0), int(n)) for c, q, n in dem_rows}
    crops = sorted(set(sup) | set(dem), key=lambda c: -(sup.get(c, (0, 0))[0] + dem.get(c, (0, 0))[0]))
    supply_demand = [
        CropSupplyDemand(
            crop=c,
            supply_kg=round(sup.get(c, (0, 0))[0], 1),
            demand_kg=round(dem.get(c, (0, 0))[0], 1),
            open_lots=sup.get(c, (0, 0))[1],
            open_demands=dem.get(c, (0, 0))[1],
            tightness=round(dem.get(c, (0, 0))[0] / max(sup.get(c, (0, 0))[0], 1.0), 2),
        )
        for c in crops[:10]
    ]

    lots_by_crop = {c: n for c, _q, n in sorted(sup_rows, key=lambda r: -int(r[2]))[:10]}
    demands_by_crop = {c: n for c, _q, n in sorted(dem_rows, key=lambda r: -int(r[2]))[:10]}

    # ---- match score distribution ----------------------------------------------
    score_rows = db.execute(select(Match.score)).scalars().all()
    buckets = [("0-30", 0), ("30-50", 0), ("50-75", 0), ("75-100", 0)]
    counts = [0, 0, 0, 0]
    for s in score_rows:
        s = float(s or 0)
        counts[0 if s < 30 else 1 if s < 50 else 2 if s < 75 else 3] += 1
    score_distribution = [ScoreBucket(label=b[0], count=counts[i]) for i, b in enumerate(buckets)]

    # ---- weekly activity (last 8 weeks) --------------------------------------
    now = datetime.now(tz=timezone.utc)
    monday = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    weeks = [monday - timedelta(weeks=i) for i in range(7, -1, -1)]

    def _by_week(model) -> dict[str, int]:
        rows = db.execute(select(model.created_at)).scalars().all()
        out: dict[str, int] = {}
        for ts in rows:
            if ts is None:
                continue
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            wk = (ts - timedelta(days=ts.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
            out[wk.date().isoformat()] = out.get(wk.date().isoformat(), 0) + 1
        return out

    deals_wk, offers_wk, users_wk = _by_week(Deal), _by_week(Offer), _by_week(User)
    weekly_activity = [
        WeeklyPoint(
            week=w.date().isoformat(),
            deals=deals_wk.get(w.date().isoformat(), 0),
            offers=offers_wk.get(w.date().isoformat(), 0),
            new_users=users_wk.get(w.date().isoformat(), 0),
        )
        for w in weeks
    ]

    # ---- price pulse: biggest movers, latest vs 30-day avg -------------------
    price_pulse: list[PricePulse] = []
    if latest_date is not None:
        since = latest_date - timedelta(days=30)
        avg_rows = db.execute(
            select(PriceCache.crop, func.avg(PriceCache.modal_price))
            .where(PriceCache.date >= since)
            .group_by(PriceCache.crop)
        ).all()
        latest_rows = db.execute(
            select(PriceCache.crop, func.avg(PriceCache.modal_price))
            .where(PriceCache.date == latest_date)
            .group_by(PriceCache.crop)
        ).all()
        avg_map = {c: float(a) for c, a in avg_rows}
        for c, latest in latest_rows:
            base = avg_map.get(c)
            latest = float(latest)
            if not base:
                continue
            price_pulse.append(PricePulse(
                crop=c, latest=round(latest, 0), avg_30d=round(base, 0),
                change_pct=round((latest - base) / base * 100, 1),
            ))
        price_pulse.sort(key=lambda p: abs(p.change_pct), reverse=True)
        price_pulse = price_pulse[:12]

    return AdminAnalyticsResponse(
        gmv_inr=round(gmv, 2),
        avg_deal_value_inr=avg_deal,
        users_total=users_total,
        users_by_role=users_by_role,
        markets_tracked=markets_tracked,
        districts_tracked=districts_tracked,
        states_tracked=states_tracked,
        price_index_latest=round(price_index_latest, 0),
        price_index_change_pct=price_index_change,
        match_conversion_pct=match_conversion,
        funnel=funnel,
        deal_pipeline=deal_pipeline,
        supply_demand=supply_demand,
        score_distribution=score_distribution,
        weekly_activity=weekly_activity,
        price_pulse=price_pulse,
        lots_by_crop=lots_by_crop,
        demands_by_crop=demands_by_crop,
    )
