"""Pooled-request (FPO collective bargaining) endpoints.

Any farmer can open a Pool for one crop; other farmers commit a quantity and an
asking price. The pool aggregates into a single virtual lot and is scored
against open buyer demands with the shared rule-based matcher.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, require_role
from app.models.pool import Pool, PoolMember
from app.models.user import User
from app.schemas.pool import (
    PoolAggregate,
    PoolCreate,
    PoolDetail,
    PoolJoin,
    PoolMemberOut,
    PoolStatusUpdate,
    PoolSummary,
)
from app.services import pools as pool_svc

router = APIRouter(prefix="/api/pools", tags=["pools"])


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


@router.get("", response_model=list[PoolSummary])
def list_pools(
    current_user: CurrentUser,
    crop: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    mine: bool = False,
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
    pool.status = body.status
    db.commit()
    db.refresh(pool)
    return _summary(db, pool)
