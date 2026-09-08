"""Discovery boards — a buyer browses open lots near them, a farmer browses
open demands near them. Read-only; the same distance model and radius veto as
the matcher so what you see here is what could actually match.
"""

from __future__ import annotations

import math

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.models.user import User
from app.services.geo import _district_coord, haversine_km

_KM_PER_DEGREE_LAT = 111.32


def _bounding_box(origin: tuple[float, float], radius_km: float) -> tuple[float, float, float, float]:
    """A conservative lat/lon box containing every point within radius_km of
    origin — a cheap SQL-level pre-filter so a radius search doesn't load
    every open lot/demand on the platform before the precise haversine
    check below. Deliberately generous (a box is a superset of the true
    circle, and cos(lat) is floored so the box never collapses near the
    poles) — it can only ever include extra rows the exact check then
    discards, never exclude a real match."""
    lat, lon = origin
    lat_delta = radius_km / _KM_PER_DEGREE_LAT
    lon_delta = radius_km / (_KM_PER_DEGREE_LAT * max(math.cos(math.radians(lat)), 0.01))
    return (lat - lat_delta, lat + lat_delta, lon - lon_delta, lon + lon_delta)

# a match in one of these states already links the two parties — the listing
# shouldn't show up on the other side's discovery board as "new".
_LIVE_MATCH = ("proposed", "offered", "accepted")


def _lots_already_engaged_with(db: Session, buyer_id: int) -> set[int]:
    """lot_ids the buyer already has a live match on (via any of their demands)."""
    return set(
        db.execute(
            select(Match.lot_id)
            .join(Demand, Match.demand_id == Demand.id)
            .where(Demand.buyer_id == buyer_id, Match.status.in_(_LIVE_MATCH))
        ).scalars().all()
    )


def _demands_already_engaged_with(db: Session, farmer_id: int) -> set[int]:
    """demand_ids the farmer already has a live match on (via any of their lots)."""
    return set(
        db.execute(
            select(Match.demand_id)
            .join(Lot, Match.lot_id == Lot.id)
            .where(Lot.farmer_id == farmer_id, Match.status.in_(_LIVE_MATCH))
        ).scalars().all()
    )


def _origin(user: User, lat: float | None, lon: float | None) -> tuple[float, float] | None:
    if lat is not None and lon is not None:
        return (lat, lon)
    if user.latitude is not None and user.longitude is not None:
        return (user.latitude, user.longitude)
    c = _district_coord(user.district or "")
    return c


def _dist(origin: tuple[float, float] | None, coords: tuple[float, float] | None) -> float | None:
    if origin is None or coords is None:
        return None
    return round(haversine_km(origin, coords), 1)


def browse_lots(
    db: Session,
    viewer: User,
    *,
    crop: str | None,
    lat: float | None,
    lon: float | None,
    radius_km: float | None,
    limit: int,
) -> list[dict]:
    origin = _origin(viewer, lat, lon)
    stmt = (
        select(Lot, User)
        .join(User, Lot.farmer_id == User.id)
        .where(Lot.status == "open", User.is_active.is_(True))
    )
    if crop:
        stmt = stmt.where(Lot.crop.ilike(crop))
    if origin is not None and radius_km is not None:
        lat_min, lat_max, lon_min, lon_max = _bounding_box(origin, radius_km)
        stmt = stmt.where(
            or_(
                # no stored coords — needs the district-centroid fallback
                # below, so it must stay a candidate regardless of the box.
                Lot.latitude.is_(None),
                and_(Lot.latitude.between(lat_min, lat_max), Lot.longitude.between(lon_min, lon_max)),
            )
        )
    rows = db.execute(stmt).all()
    engaged = _lots_already_engaged_with(db, viewer.id)

    out: list[dict] = []
    for lot, farmer in rows:
        if farmer.id == viewer.id or lot.id in engaged:
            continue
        coords = (
            (lot.latitude, lot.longitude)
            if lot.latitude is not None and lot.longitude is not None
            else _district_coord(lot.location or "")
        )
        km = _dist(origin, coords)
        if radius_km is not None and km is not None and km > radius_km:
            continue
        out.append({
            "id": lot.id,
            "crop": lot.crop,
            "quantity_kg": lot.quantity_kg,
            "quality_grade": lot.quality_grade,
            "expected_price": lot.expected_price,
            "available_from": lot.available_from,
            "location": lot.location,
            "distance_km": km,
            "farmer_id": farmer.id,
            "farmer_name": farmer.name,
            "farmer_district": farmer.district,
            "farmer_verified": farmer.verification_status == "verified",
            "has_photo": bool(lot.photo_url),
        })
    out.sort(key=lambda r: (r["distance_km"] is None, r["distance_km"] or 0.0))
    return out[:limit]


def browse_demands(
    db: Session,
    viewer: User,
    *,
    crop: str | None,
    lat: float | None,
    lon: float | None,
    radius_km: float | None,
    limit: int,
) -> list[dict]:
    origin = _origin(viewer, lat, lon)
    stmt = (
        select(Demand, User)
        .join(User, Demand.buyer_id == User.id)
        .where(Demand.status == "open", User.is_active.is_(True))
    )
    if crop:
        stmt = stmt.where(Demand.crop.ilike(crop))
    if origin is not None and radius_km is not None:
        lat_min, lat_max, lon_min, lon_max = _bounding_box(origin, radius_km)
        stmt = stmt.where(
            or_(
                # no stored coords — needs the delivery-district/buyer-
                # district centroid fallback below, so it must stay a
                # candidate regardless of the box.
                Demand.latitude.is_(None),
                and_(Demand.latitude.between(lat_min, lat_max), Demand.longitude.between(lon_min, lon_max)),
            )
        )
    rows = db.execute(stmt).all()
    engaged = _demands_already_engaged_with(db, viewer.id)

    out: list[dict] = []
    for dem, buyer in rows:
        if buyer.id == viewer.id or dem.id in engaged:
            continue
        coords = (
            (dem.latitude, dem.longitude)
            if dem.latitude is not None and dem.longitude is not None
            else _district_coord(dem.delivery_district or buyer.district or "")
        )
        km = _dist(origin, coords)
        if radius_km is not None and km is not None and km > radius_km:
            continue
        out.append({
            "id": dem.id,
            "crop": dem.crop,
            "quantity_kg": dem.quantity_kg,
            "quality_spec": dem.quality_spec,
            "quality_grade_min": dem.quality_grade_min,
            "price_band_min": dem.price_band_min,
            "price_band_max": dem.price_band_max,
            "delivery_window": dem.delivery_window,
            "delivery_district": dem.delivery_district or buyer.district,
            "distance_km": km,
            "buyer_id": buyer.id,
            "buyer_name": buyer.name,
            "buyer_district": buyer.district,
            "buyer_verified": buyer.verification_status == "verified",
        })
    out.sort(key=lambda r: (r["distance_km"] is None, r["distance_km"] or 0.0))
    return out[:limit]
