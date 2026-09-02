"""Rule-based lot×demand match scoring engine.

Design (from 2-CONTEXT.md D-20 to D-22):
- score_pair is a pure function — no ORM objects, fully testable without a DB.
- Three components: quantity fit (0–30), price overlap (0–40), distance (0–30).
- Total 0–100. Only pairs scoring >= MIN_SCORE are upserted as Match rows.
- run_matching() is called synchronously after every new lot or demand.
- score_detail is stored as a JSON string on Match.score_detail for explainability.
"""

import json
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.models.user import User
from app.services.geo import district_distance_km

logger = logging.getLogger(__name__)

# Scoring weights
QUANTITY_MAX = 30
PRICE_MAX = 40
DISTANCE_MAX = 30
MIN_SCORE = 30  # pairs below this threshold are not stored


# ---------------------------------------------------------------------------
# Pure scoring components — no DB access, fully unit-testable
# ---------------------------------------------------------------------------

def _quantity_score(lot_qty: float, demand_qty: float) -> float:
    """0–30 pts.  Ratio of the smaller to the larger quantity × 30."""
    if lot_qty <= 0 or demand_qty <= 0:
        return 0.0
    ratio = min(lot_qty, demand_qty) / max(lot_qty, demand_qty)
    return round(ratio * QUANTITY_MAX, 2)


def _price_score(expected: float, band_min: float, band_max: float) -> float:
    """0–40 pts.

    - expected fully within [band_min, band_max] → 40
    - expected outside with some proximity → partial credit scaled by how far
      the price is from the nearest band edge relative to band width
    - band_width == 0 (point price) → 40 if exact match, 0 otherwise
    """
    if band_min <= expected <= band_max:
        return float(PRICE_MAX)

    band_width = band_max - band_min
    if band_width <= 0:
        return 0.0

    gap = max(0.0, band_min - expected, expected - band_max)
    fraction = max(0.0, 1.0 - gap / band_width)
    return round(fraction * PRICE_MAX, 2)


def pair_distance_km(
    lot_location: str,
    buyer_district: str,
    lot_coords: tuple[float, float] | None = None,
    demand_coords: tuple[float, float] | None = None,
) -> float | None:
    """Best-available distance (km) between a lot and where the buyer wants it.

    Preference order: point-to-point (both geocoded) → lot coords ↔ buyer
    district centroid → district ↔ district centroids → ``None`` when neither
    side can be placed.
    """
    from app.services.geo import _district_coord, haversine_km

    demand_c = demand_coords or _district_coord(buyer_district or "")
    lot_c = lot_coords or _district_coord(lot_location or "")
    if lot_c and demand_c:
        return round(haversine_km(lot_c, demand_c), 1)
    return district_distance_km(lot_location, buyer_district)


def _distance_score(
    lot_location: str,
    buyer_district: str,
    lot_coords: tuple[float, float] | None = None,
    demand_coords: tuple[float, float] | None = None,
) -> float:
    """0–30 pts based on distance between the lot and where the buyer wants it.

    Brackets: ≤50 km → 30, 51–150 km → 20, 151–300 km → 10, >300 km → 0.
    Unknown → neutral 15 pts (don't penalise missing geo data).
    """
    dist = pair_distance_km(lot_location, buyer_district, lot_coords, demand_coords)
    if dist is None:
        return 15.0
    if dist <= 50:
        return 30.0
    if dist <= 150:
        return 20.0
    if dist <= 300:
        return 10.0
    return 0.0


_GRADE_RANK = {"a": 0, "b": 1, "c": 2, "d": 3}


def _grade_of(text: str) -> str | None:
    """Pull a grade letter out of free text like 'Grade A, no blemishes' / 'FAQ'."""
    import re

    m = re.search(r"\bgrade\s*([abcd])\b", text.lower()) or re.search(r"\b([abcd])\s*grade\b", text.lower())
    if m:
        return m.group(1)
    t = text.strip().lower()
    if t in _GRADE_RANK:
        return t
    if "faq" in t or "fair average" in t:
        return "b"
    return None


def quality_factor(lot_grade: str, demand_spec: str) -> float:
    """1.0 when the lot meets/exceeds the grade the buyer asked for; a gentle
    discount per grade short; 1.0 (neutral) when the spec names no grade."""
    want = _grade_of(demand_spec or "")
    have = _grade_of(lot_grade or "")
    if want is None or have is None:
        return 1.0
    short = _GRADE_RANK[have] - _GRADE_RANK[want]
    if short <= 0:
        return 1.0
    return max(0.6, 1.0 - 0.18 * short)


_WINDOW_DAYS = [
    (r"same day|today|immediat", 0),
    (r"(\d+)\s*day", None),   # captured
    (r"(\d+)\s*week", None),  # captured *7
    (r"month", 30),
    (r"fortnight", 14),
]


def _window_days(text: str) -> int | None:
    import re

    t = (text or "").lower()
    for pat, fixed in _WINDOW_DAYS:
        m = re.search(pat, t)
        if not m:
            continue
        if fixed is not None:
            return fixed
        n = int(m.group(1))
        return n * 7 if "week" in pat else n
    return None


def timing_factor(lot_available_from, demand_window: str, today=None) -> float:
    """1.0 when the lot is (or will be) available inside the buyer's delivery
    window; 0.8 when it lands late; 1.0 when either side is unparseable."""
    from datetime import date

    days = _window_days(demand_window or "")
    if days is None or lot_available_from is None:
        return 1.0
    today = today or date.today()
    lead = (lot_available_from - today).days
    return 1.0 if lead <= days else 0.8


def score_tier(total: float) -> str:
    if total >= 75:
        return "strong"
    if total >= 50:
        return "good"
    if total >= MIN_SCORE:
        return "fair"
    return "weak"


def score_pair(
    lot_qty: float,
    lot_expected_price: float,
    lot_location: str,
    demand_qty: float,
    demand_band_min: float,
    demand_band_max: float,
    buyer_district: str,
    lot_coords: tuple[float, float] | None = None,
    *,
    demand_coords: tuple[float, float] | None = None,
    lot_grade: str = "",
    lot_available_from=None,
    demand_quality_spec: str = "",
    demand_delivery_window: str = "",
) -> tuple[float, str]:
    """Compute match score and return (total_score, score_detail_json).

    Pure function — accepts plain values, not ORM objects. The three core
    components (quantity, price overlap, distance) sum to a 0-100 base; grade
    fit and delivery timing then scale it down when they don't line up, so a
    perfect match still scores 100 and the number stays a real 0-100 confidence.
    """
    q = _quantity_score(lot_qty, demand_qty)
    p = _price_score(lot_expected_price, demand_band_min, demand_band_max)
    d = _distance_score(lot_location, buyer_district, lot_coords, demand_coords)
    base = round(q + p + d, 2)

    qf = quality_factor(lot_grade, demand_quality_spec)
    tf = timing_factor(lot_available_from, demand_delivery_window)
    total = round(base * qf * tf, 2)

    detail = json.dumps({
        "quantity": q,
        "price": p,
        "distance": d,
        "base": base,
        "quality_factor": round(qf, 2),
        "timing_factor": round(tf, 2),
        "total": total,
        "max": QUANTITY_MAX + PRICE_MAX + DISTANCE_MAX,
        "tier": score_tier(total),
    })
    return total, detail


# ---------------------------------------------------------------------------
# DB-level scoring
# ---------------------------------------------------------------------------

def _demand_point(
    demand: Demand, buyer_district: str | None, buyer_lat, buyer_lon
) -> tuple[str, tuple[float, float] | None]:
    """Where the buyer wants delivery: the demand's own district/coords when it
    has them, otherwise the buyer's profile district/coords."""
    district = demand.delivery_district or buyer_district or ""
    lat = demand.latitude if demand.latitude is not None else buyer_lat
    lon = demand.longitude if demand.longitude is not None else buyer_lon
    coords = (lat, lon) if lat is not None and lon is not None else None
    return district, coords


def _lot_point(lot: Lot) -> tuple[float, float] | None:
    if lot.latitude is not None and lot.longitude is not None:
        return (lot.latitude, lot.longitude)
    return None


def _score_and_upsert(db: Session, lot: Lot, demand: Demand,
                      district: str, coords: tuple[float, float] | None,
                      max_km: float) -> int:
    """Score one open lot × open demand pair. Upsert a proposed Match when it
    clears the veto + MIN_SCORE; reject a now-stale proposed/offered Match when
    it no longer does. Returns 1 if a row was written, else 0."""
    if lot.crop.strip().lower() != demand.crop.strip().lower():
        return 0

    lot_coords = _lot_point(lot)
    dist = pair_distance_km(lot.location, district, lot_coords, coords)
    vetoed = dist is not None and dist > max_km

    total = 0.0
    detail = None
    if not vetoed:
        total, detail = score_pair(
            lot_qty=lot.quantity_kg, lot_expected_price=lot.expected_price,
            lot_location=lot.location, demand_qty=demand.quantity_kg,
            demand_band_min=demand.price_band_min, demand_band_max=demand.price_band_max,
            buyer_district=district, lot_coords=lot_coords, demand_coords=coords,
            lot_grade=lot.quality_grade or "", lot_available_from=lot.available_from,
            demand_quality_spec=demand.quality_grade_min or demand.quality_spec or "",
            demand_delivery_window=demand.delivery_window or "",
        )

    existing = db.execute(
        select(Match).where(Match.lot_id == lot.id, Match.demand_id == demand.id)
    ).scalar_one_or_none()

    if vetoed or total < MIN_SCORE:
        # no longer a match — retire a stale proposal so it leaves the boards
        if existing is not None and existing.status in ("proposed", "offered"):
            existing.status = "rejected"
            return 1
        return 0

    if existing is not None:
        if existing.status in ("proposed", "offered"):
            existing.score = total
            existing.score_detail = detail
            existing.status = "proposed"
            return 1
        return 0

    db.add(Match(lot_id=lot.id, demand_id=demand.id, score=total,
                 score_detail=detail, status="proposed"))
    return 1


def match_lot(db: Session, lot: Lot) -> int:
    """Incremental: score one lot against every open demand (O(demands), not the
    full O(lots×demands) sweep). Call after a lot is created or edited."""
    if lot.status != "open":
        return 0
    from app.core.config import settings

    rows = db.execute(
        select(Demand, User.district, User.latitude, User.longitude)
        .join(User, Demand.buyer_id == User.id)
        .where(Demand.status == "open", Demand.crop.ilike(lot.crop.strip()))
    ).all()
    n = 0
    for demand, bd, blat, blon in rows:
        district, coords = _demand_point(demand, bd, blat, blon)
        n += _score_and_upsert(db, lot, demand, district, coords, settings.match_max_km)
    db.commit()
    logger.info("match_lot(%s): %d matches touched", lot.id, n)
    return n


def match_demand(db: Session, demand: Demand) -> int:
    """Incremental: score one demand against every open lot. Call after a demand
    is created or edited."""
    if demand.status != "open":
        return 0
    from app.core.config import settings

    buyer = db.get(User, demand.buyer_id)
    district, coords = _demand_point(
        demand, buyer.district if buyer else None,
        buyer.latitude if buyer else None, buyer.longitude if buyer else None,
    )
    lots = db.execute(
        select(Lot).where(Lot.status == "open", Lot.crop.ilike(demand.crop.strip()))
    ).scalars().all()
    n = 0
    for lot in lots:
        n += _score_and_upsert(db, lot, demand, district, coords, settings.match_max_km)
    db.commit()
    logger.info("match_demand(%s): %d matches touched", demand.id, n)
    return n


def run_matching(db: Session) -> int:
    """Score all open lot×demand pairs sharing the same crop and upsert Match rows.

    Only pairs with total_score >= MIN_SCORE are inserted/updated.
    Already-accepted or rejected matches are left untouched.
    Returns the number of rows upserted.
    """
    # Load all open lots
    open_lots = db.execute(
        select(Lot).where(Lot.status == "open")
    ).scalars().all()

    # Load all open demands with the buyer's district + coordinates so distance
    # scoring works off the demand's own delivery point when it has one.
    open_demands_with_buyer = db.execute(
        select(
            Demand,
            User.district.label("buyer_district"),
            User.latitude.label("buyer_lat"),
            User.longitude.label("buyer_lon"),
        )
        .join(User, Demand.buyer_id == User.id)
        .where(Demand.status == "open")
    ).all()

    from app.core.config import settings
    max_km = settings.match_max_km

    # pre-resolve each demand's delivery point once
    demand_points = [
        (row[0], *_demand_point(row[0], row[1], row[2], row[3]))
        for row in open_demands_with_buyer
    ]

    upserted = 0
    for lot in open_lots:
        for demand, district, coords in demand_points:
            upserted += _score_and_upsert(db, lot, demand, district, coords, max_km)

    db.commit()
    logger.info("run_matching: %d matches touched", upserted)
    return upserted


def try_pair(db: Session, lot: Lot, demand: Demand) -> dict:
    """Score one specific lot×demand pair (used by the 'express interest' buttons
    on the discovery boards). Upserts a proposed Match when it clears the veto
    and MIN_SCORE. Returns {matched, match_id?, score?, reason?}."""
    from app.core.config import settings

    if lot.crop.strip().lower() != demand.crop.strip().lower():
        return {"matched": False, "reason": "different crop"}

    buyer = db.get(User, demand.buyer_id)
    d_district, d_coords = _demand_point(
        demand, buyer.district if buyer else None,
        buyer.latitude if buyer else None, buyer.longitude if buyer else None,
    )
    lot_coords = _lot_point(lot)

    dist = pair_distance_km(lot.location, d_district, lot_coords, d_coords)
    if dist is not None and dist > settings.match_max_km:
        return {"matched": False, "reason": f"about {round(dist)} km apart — beyond range"}

    total, detail = score_pair(
        lot_qty=lot.quantity_kg, lot_expected_price=lot.expected_price, lot_location=lot.location,
        demand_qty=demand.quantity_kg, demand_band_min=demand.price_band_min,
        demand_band_max=demand.price_band_max, buyer_district=d_district,
        lot_coords=lot_coords, demand_coords=d_coords,
        lot_grade=lot.quality_grade or "", lot_available_from=lot.available_from,
        demand_quality_spec=demand.quality_grade_min or demand.quality_spec or "",
        demand_delivery_window=demand.delivery_window or "",
    )
    if total < MIN_SCORE:
        return {"matched": False, "score": total, "reason": "quantity / price / distance don't line up well enough yet"}

    existing = db.execute(
        select(Match).where(Match.lot_id == lot.id, Match.demand_id == demand.id)
    ).scalar_one_or_none()
    if existing is not None:
        if existing.status in ("proposed", "offered"):
            existing.score = total
            existing.score_detail = detail
        db.commit()
        return {"matched": True, "match_id": existing.id, "score": total}

    m = Match(lot_id=lot.id, demand_id=demand.id, score=total, score_detail=detail, status="proposed")
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"matched": True, "match_id": m.id, "score": total}


# ---------------------------------------------------------------------------
# Validation — is the stored match set still any good?
# ---------------------------------------------------------------------------

def matching_health(db: Session) -> dict:
    """Re-derive every non-terminal Match from the *current* lot & demand and
    report how well the stored set holds up. Used by the admin dashboard and a
    regression test so match quality is measured, not assumed.

    Buckets:
      consistent    — recomputed score still >= MIN_SCORE and within 10 pts
      drifted       — still a match, but the score moved > 10 pts
      degraded      — recomputed score fell below MIN_SCORE (lot/demand changed)
      crop_mismatch — the crops no longer agree (should never happen)
      orphaned      — the lot or demand row is gone
    """
    rows = db.execute(
        select(
            Match, Lot, Demand,
            User.district.label("bd"),
            User.latitude.label("blat"),
            User.longitude.label("blon"),
        )
        .join(Lot, Match.lot_id == Lot.id, isouter=True)
        .join(Demand, Match.demand_id == Demand.id, isouter=True)
        .join(User, Demand.buyer_id == User.id, isouter=True)
        .where(Match.status.in_(("proposed", "offered")))
    ).all()

    buckets = {"consistent": 0, "drifted": 0, "degraded": 0, "crop_mismatch": 0, "orphaned": 0}
    deltas: list[float] = []
    tiers: dict[str, int] = {}

    for match, lot, demand, bd, blat, blon in rows:
        if lot is None or demand is None:
            buckets["orphaned"] += 1
            continue
        if lot.crop.strip().lower() != demand.crop.strip().lower():
            buckets["crop_mismatch"] += 1
            continue
        coords = _lot_point(lot)
        d_district, d_coords = _demand_point(demand, bd, blat, blon)
        recomputed, detail = score_pair(
            lot.quantity_kg, lot.expected_price, lot.location,
            demand.quantity_kg, demand.price_band_min, demand.price_band_max,
            d_district, coords,
            demand_coords=d_coords,
            lot_grade=lot.quality_grade or "", lot_available_from=lot.available_from,
            demand_quality_spec=demand.quality_grade_min or demand.quality_spec or "",
            demand_delivery_window=demand.delivery_window or "",
        )
        delta = abs(recomputed - (match.score or 0))
        deltas.append(delta)
        tiers[score_tier(recomputed)] = tiers.get(score_tier(recomputed), 0) + 1
        if recomputed < MIN_SCORE:
            buckets["degraded"] += 1
        elif delta > 10:
            buckets["drifted"] += 1
        else:
            buckets["consistent"] += 1

    total = sum(buckets.values())
    scored = total - buckets["orphaned"] - buckets["crop_mismatch"]
    return {
        "total_matches": total,
        "buckets": buckets,
        "tier_distribution": tiers,
        "mean_abs_score_delta": round(sum(deltas) / len(deltas), 2) if deltas else 0.0,
        # share of live matches that still recompute as a real match
        "precision": round((buckets["consistent"] + buckets["drifted"]) / scored, 3) if scored else 1.0,
        "healthy": buckets["degraded"] == 0 and buckets["crop_mismatch"] == 0 and buckets["orphaned"] == 0,
    }
