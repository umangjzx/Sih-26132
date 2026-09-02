"""Pooled-request (FPO collective bargaining) endpoints.

Any farmer can open a Pool for one crop; other farmers commit a quantity and an
asking price. The pool aggregates into a single virtual lot and is scored
against open buyer demands with the shared rule-based matcher.
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.deal import Deal
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.models.offer import Offer
from app.models.pool import Pool, PoolMember
from app.models.user import User
from app.schemas.pool import (
    PoolAcceptDemand,
    PoolAggregate,
    PoolCreate,
    PoolDealResult,
    PoolDetail,
    PoolJoin,
    PoolMemberOut,
    PoolStatusUpdate,
    PoolSummary,
)
from app.services import pools as pool_svc
from app.services.audit import log_event
from app.services.geo import _district_coord, haversine_km

router = APIRouter(prefix="/api/pools", tags=["pools"])

# organizer-driven pool lifecycle: which target states are reachable from each
_POOL_TRANSITIONS: dict[str, set[str]] = {
    "open": {"locked", "closed"},
    "locked": {"open", "matched", "closed"},
    "matched": {"closed"},
    "closed": set(),
}


def _members(db: Session, pool_id: int) -> list[PoolMember]:
    return list(
        db.execute(select(PoolMember).where(PoolMember.pool_id == pool_id)).scalars().all()
    )


def _summary(db: Session, pool: Pool, members: list[PoolMember] | None = None) -> PoolSummary:
    members = members if members is not None else _members(db, pool.id)
    committed = [m for m in members if m.status == "committed"]
    qty = round(sum(m.quantity_kg for m in committed), 2)
    organizer = db.get(User, pool.organizer_id)
    s = PoolSummary.model_validate(pool)
    s.organizer_name = organizer.name if organizer else None
    s.members = len(committed)
    s.committed_quantity_kg = qty
    s.fill_pct = round(100 * qty / pool.target_quantity_kg, 1) if pool.target_quantity_kg else 0.0
    return s


@router.post("", response_model=PoolSummary, status_code=status.HTTP_201_CREATED)
def create_pool(
    body: PoolCreate,
    current_user: CurrentUser,
    _role: Annotated[None, require_role("farmer")] = None,
    db: Session = Depends(get_db),
) -> PoolSummary:
    pool = Pool(organizer_id=current_user.id, **body.model_dump())
    if not pool.location:
        pool.location = current_user.district or ""
    try:
        from app.services.geocode import geocode

        geo = geocode(pool.location, db) if pool.location else None
        if geo:
            pool.latitude = geo["latitude"]
            pool.longitude = geo["longitude"]
    except Exception:  # noqa: BLE001 — geocoding never blocks pool creation
        pass

    db.add(pool)
    db.commit()
    db.refresh(pool)

    # The organizer is the first member unless they opted out with quantity 0.
    return _summary(db, pool, [])


def _pool_coord(pool: Pool) -> tuple[float, float] | None:
    if pool.latitude is not None and pool.longitude is not None:
        return (pool.latitude, pool.longitude)
    return _district_coord(pool.location or "")


@router.get("", response_model=list[PoolSummary])
def list_pools(
    current_user: CurrentUser,
    crop: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    mine: bool = False,
    lat: float | None = None,
    lon: float | None = None,
    radius_km: float | None = Query(None, gt=0, le=3000),
    db: Session = Depends(get_db),
) -> list[PoolSummary]:
    stmt = select(Pool).order_by(Pool.id.desc())
    if crop:
        stmt = stmt.where(Pool.crop.ilike(crop))
    if status_filter:
        stmt = stmt.where(Pool.status == status_filter)
    pools = list(db.execute(stmt).scalars().all())

    if mine:
        member_pool_ids = set(
            db.execute(
                select(PoolMember.pool_id).where(PoolMember.farmer_id == current_user.id)
            ).scalars().all()
        )
        pools = [p for p in pools if p.organizer_id == current_user.id or p.id in member_pool_ids]
    else:
        pools = [p for p in pools if p.status in ("open", "locked")]
        # a precise fix (from the browser) drops pools outside the radius
        origin = (lat, lon) if lat is not None and lon is not None else (
            (current_user.latitude, current_user.longitude)
            if current_user.latitude is not None and current_user.longitude is not None else None
        )
        if origin is not None and radius_km is not None:
            def near(p: Pool) -> bool:
                c = _pool_coord(p)
                return c is None or haversine_km(origin, c) <= radius_km
            pools = [p for p in pools if near(p)]

    return [_summary(db, p) for p in pools]


@router.get("/{pool_id}", response_model=PoolDetail)
def get_pool(
    pool_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> PoolDetail:
    pool = db.get(Pool, pool_id)
    if pool is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pool not found")

    members = _members(db, pool_id)
    names = {
        u.id: u.name
        for u in db.execute(
            select(User).where(User.id.in_([m.farmer_id for m in members] or [0]))
        ).scalars().all()
    }

    agg = pool_svc.aggregate(pool, members)
    is_org = pool.organizer_id == current_user.id
    candidates = pool_svc.demand_candidates(db, pool, members) if is_org else []

    member_out: list[PoolMemberOut] = []
    mine: PoolMemberOut | None = None
    for m in members:
        mo = PoolMemberOut.model_validate(m)
        mo.farmer_name = names.get(m.farmer_id)
        member_out.append(mo)
        if m.farmer_id == current_user.id:
            mine = mo

    detail = PoolDetail(
        **_summary(db, pool, members).model_dump(),
        aggregate=PoolAggregate(**agg),
        member_list=member_out,
        candidates=candidates,  # type: ignore[arg-type]
        is_organizer=is_org,
        my_membership=mine,
    )
    return detail


@router.post("/{pool_id}/join", response_model=PoolMemberOut)
def join_pool(
    pool_id: int,
    body: PoolJoin,
    current_user: CurrentUser,
    _role: Annotated[None, require_role("farmer")] = None,
    db: Session = Depends(get_db),
) -> PoolMemberOut:
    pool = db.get(Pool, pool_id)
    if pool is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pool not found")
    if pool.status != "open":
        raise HTTPException(status.HTTP_409_CONFLICT, "This pool is no longer accepting members")

    existing = db.execute(
        select(PoolMember).where(
            PoolMember.pool_id == pool_id, PoolMember.farmer_id == current_user.id
        )
    ).scalar_one_or_none()

    if existing is not None:
        existing.quantity_kg = body.quantity_kg
        existing.expected_price = body.expected_price
        existing.lot_id = body.lot_id
        existing.status = "committed"
        member = existing
    else:
        member = PoolMember(
            pool_id=pool_id,
            farmer_id=current_user.id,
            lot_id=body.lot_id,
            quantity_kg=body.quantity_kg,
            expected_price=body.expected_price,
            status="committed",
        )
        db.add(member)

    db.commit()
    db.refresh(member)
    out = PoolMemberOut.model_validate(member)
    out.farmer_name = current_user.name
    return out


@router.post("/{pool_id}/withdraw", response_model=PoolMemberOut)
def withdraw_from_pool(
    pool_id: int,
    current_user: CurrentUser,
    _role: Annotated[None, require_role("farmer")] = None,
    db: Session = Depends(get_db),
) -> PoolMemberOut:
    pool = db.get(Pool, pool_id)
    if pool is not None and pool.status in ("matched", "closed"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This pool is already matched to a buyer — you can't withdraw now.",
        )
    member = db.execute(
        select(PoolMember).where(
            PoolMember.pool_id == pool_id, PoolMember.farmer_id == current_user.id
        )
    ).scalar_one_or_none()
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You are not in this pool")
    member.status = "withdrawn"
    db.commit()
    db.refresh(member)
    out = PoolMemberOut.model_validate(member)
    out.farmer_name = current_user.name
    return out


@router.post("/{pool_id}/status", response_model=PoolSummary)
def set_pool_status(
    pool_id: int,
    body: PoolStatusUpdate,
    current_user: CurrentUser,
    _role: Annotated[None, require_role("farmer")] = None,
    db: Session = Depends(get_db),
) -> PoolSummary:
    pool = db.get(Pool, pool_id)
    if pool is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pool not found")
    if pool.organizer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the organizer can change the pool status")
    if body.status == pool.status:
        return _summary(db, pool)
    if body.status not in _POOL_TRANSITIONS.get(pool.status, set()):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Can't move a pool from '{pool.status}' to '{body.status}'.",
        )
    old = pool.status
    pool.status = body.status
    db.flush()
    log_event(db, actor_id=current_user.id, entity_type="pool", entity_id=pool.id,
              action="pool_status_changed", detail={"from": old, "to": body.status})
    db.commit()
    db.refresh(pool)
    return _summary(db, pool)


@router.post("/{pool_id}/accept-demand", response_model=PoolDealResult, status_code=status.HTTP_201_CREATED)
def accept_demand_for_pool(
    pool_id: int,
    body: PoolAcceptDemand,
    current_user: CurrentUser,
    _role: Annotated[None, require_role("farmer")] = None,
    db: Session = Depends(get_db),
) -> PoolDealResult:
    """Organizer converts the aggregated pool into a real deal against one buyer
    demand: it materialises a Lot from the pool total, an accepted Match + Offer,
    and a Deal — so the normal deal pipeline (logistics, payment, disputes) takes
    over. The pool is locked to `matched` and members can no longer withdraw."""
    pool = db.get(Pool, pool_id)
    if pool is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pool not found")
    if pool.organizer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the organizer can accept a demand")
    if pool.status not in ("open", "locked"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Pool is '{pool.status}', not open for matching")

    members = _members(db, pool_id)
    agg = pool_svc.aggregate(pool, members)
    if agg["quantity_kg"] <= 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "The pool has no committed quantity yet")

    demand = db.get(Demand, body.demand_id)
    if demand is None or demand.status != "open":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demand not found or not open")
    if demand.crop.strip().lower() != pool.crop.strip().lower():
        raise HTTPException(status.HTTP_409_CONFLICT, "That demand is for a different crop")

    agreed_price = body.agreed_price or agg["effective_price"]
    qty = agg["quantity_kg"]

    lot = Lot(
        farmer_id=pool.organizer_id, crop=pool.crop, quantity_kg=qty,
        quality_grade=pool.grade or "B", expected_price=agreed_price,
        available_from=date.today(), location=pool.location or current_user.district or "",
        latitude=pool.latitude, longitude=pool.longitude,
        pool_id=pool.id, status="matched",
    )
    db.add(lot); db.flush()

    match = Match(lot_id=lot.id, demand_id=demand.id, score=90.0, status="accepted")
    db.add(match); db.flush()
    offer = Offer(match_id=match.id, from_user_id=pool.organizer_id, price=agreed_price,
                  quantity=qty, message=f"FPO pool: {pool.title}", status="accepted")
    db.add(offer)
    deal = Deal(match_id=match.id, agreed_price=agreed_price, agreed_quantity=qty,
                logistics_mode="hired_transport", payment_status="pending",
                pipeline_status="matched")
    db.add(deal); db.flush()

    pool.status = "matched"
    pool.matched_deal_id = deal.id
    demand.status = "matched"

    log_event(db, actor_id=current_user.id, entity_type="pool", entity_id=pool.id,
              action="pool_deal_created",
              detail={"deal_id": deal.id, "demand_id": demand.id,
                      "agreed_price": agreed_price, "quantity_kg": qty,
                      "members": agg["members"]})
    log_event(db, actor_id=current_user.id, entity_type="deal", entity_id=deal.id,
              action="deal_created",
              detail={"from": "pool", "pool_id": pool.id,
                      "agreed_price": agreed_price, "agreed_quantity": qty})
    db.commit()
    db.refresh(deal)
    return PoolDealResult(
        deal_id=deal.id, lot_id=lot.id, match_id=match.id,
        agreed_price=agreed_price, agreed_quantity_kg=qty,
    )
