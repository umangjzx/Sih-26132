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


def _distance_score(
    lot_location: str,
    buyer_district: str,
    lot_coords: tuple[float, float] | None = None,
) -> float:
    """0–30 pts based on distance between the lot and the buyer's district.

    Uses the lot's geocoded coordinates when available (more precise than the
    district centroid), otherwise the district-centroid haversine.
    Brackets: ≤50 km → 30, 51–150 km → 20, 151–300 km → 10, >300 km → 0.
    Unknown → neutral 15 pts (don't penalise missing geo data).
    """
    dist: float | None
    if lot_coords is not None:
        from app.services.geo import DISTRICT_CENTROIDS, haversine_km

        buyer_c = DISTRICT_CENTROIDS.get(buyer_district)
        dist = round(haversine_km(lot_coords, buyer_c), 1) if buyer_c else None
    else:
        dist = district_distance_km(lot_location, buyer_district)
    if dist is None:
        return 15.0
    if dist <= 50:
        return 30.0
    if dist <= 150:
        return 20.0
    if dist <= 300:
        return 10.0
    return 0.0


def score_pair(
    lot_qty: float,
    lot_expected_price: float,
    lot_location: str,
    demand_qty: float,
    demand_band_min: float,
    demand_band_max: float,
    buyer_district: str,
    lot_coords: tuple[float, float] | None = None,
) -> tuple[float, str]:
    """Compute match score and return (total_score, score_detail_json).

    Pure function — accepts plain values, not ORM objects.
    score_detail_json is a compact JSON string suitable for Match.score_detail.
    """
    q = _quantity_score(lot_qty, demand_qty)
    p = _price_score(lot_expected_price, demand_band_min, demand_band_max)
    d = _distance_score(lot_location, buyer_district, lot_coords)
    total = round(q + p + d, 2)
    detail = json.dumps({
        "quantity": q,
        "price": p,
        "distance": d,
        "total": total,
        "max": QUANTITY_MAX + PRICE_MAX + DISTANCE_MAX,
    })
    return total, detail


# ---------------------------------------------------------------------------
# DB-level scoring run
# ---------------------------------------------------------------------------

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

    # Load all open demands joined with buyer's district from users
    open_demands_with_district = db.execute(
        select(Demand, User.district.label("buyer_district"))
        .join(User, Demand.buyer_id == User.id)
        .where(Demand.status == "open")
    ).all()

    upserted = 0

    for lot in open_lots:
        for row in open_demands_with_district:
            demand = row[0]
            buyer_district: str = row[1] or ""

            # Only score if crops match (case-insensitive)
            if lot.crop.strip().lower() != demand.crop.strip().lower():
                continue

            lot_coords = (
                (lot.latitude, lot.longitude)
                if lot.latitude is not None and lot.longitude is not None
                else None
            )
            total, detail = score_pair(
                lot_qty=lot.quantity_kg,
                lot_expected_price=lot.expected_price,
                lot_location=lot.location,
                demand_qty=demand.quantity_kg,
                demand_band_min=demand.price_band_min,
                demand_band_max=demand.price_band_max,
                buyer_district=buyer_district,
                lot_coords=lot_coords,
            )

            if total < MIN_SCORE:
                continue

            # Upsert: update existing proposed/offered match, insert if new
            existing = db.execute(
                select(Match).where(
                    Match.lot_id == lot.id,
                    Match.demand_id == demand.id,
                )
            ).scalar_one_or_none()

            if existing is not None:
                if existing.status in ("proposed", "offered"):
                    existing.score = total
                    existing.score_detail = detail
                    upserted += 1
            else:
                db.add(Match(
                    lot_id=lot.id,
                    demand_id=demand.id,
                    score=total,
                    score_detail=detail,
                    status="proposed",
                ))
                upserted += 1

    db.commit()
    logger.info("run_matching: %d matches upserted", upserted)
    return upserted
