"""Matching v2: grade-fit and delivery-timing modifiers, tier labels, and the
matching_health() validation harness.
"""

from datetime import date, timedelta

from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.models.user import User
from app.services.matching import (
    MIN_SCORE,
    matching_health,
    quality_factor,
    run_matching,
    score_pair,
    score_tier,
    timing_factor,
)


# --------------------------------------------------------------------------- #
# pure modifiers
# --------------------------------------------------------------------------- #

def test_quality_factor():
    assert quality_factor("Grade A", "Grade A, no blemishes") == 1.0
    assert quality_factor("A", "needs grade B or better") == 1.0     # A exceeds B
    assert 0.55 < quality_factor("Grade C", "Grade A only") < 0.8    # 2 grades short
    assert quality_factor("Grade B", "Grade A only") < 1.0           # 1 grade short
    assert quality_factor("FAQ", "Grade B") == 1.0                   # FAQ ~ B
    assert quality_factor("anything", "no grade mentioned here") == 1.0


def test_timing_factor():
    today = date(2026, 9, 1)
    assert timing_factor(date(2026, 9, 3), "Within 7 days", today) == 1.0
    assert timing_factor(date(2026, 9, 20), "Within 7 days", today) == 0.8
    assert timing_factor(date(2026, 9, 20), "delivery in 3 weeks", today) == 1.0
    assert timing_factor(None, "Within 7 days", today) == 1.0        # unparseable side


def test_score_pair_applies_modifiers_and_tiers():
    # perfect core match, but lot is 2 grades under and lands late
    total, detail = score_pair(
        500, 2400, "Pune", 500, 2000, 2800, "Pune",
        lot_grade="Grade C", lot_available_from=date.today() + timedelta(days=40),
        demand_quality_spec="Grade A", demand_delivery_window="Within 5 days",
    )
    import json
    d = json.loads(detail)
    assert d["base"] == 100.0
    assert d["quality_factor"] < 1.0 and d["timing_factor"] == 0.8
    assert total < 100 and total == round(100 * d["quality_factor"] * d["timing_factor"], 2)
    assert d["tier"] == score_tier(total)


def test_score_pair_perfect_still_100():
    total, _ = score_pair(500, 2400, "Pune", 500, 2000, 2800, "Pune",
                          lot_grade="A", demand_quality_spec="Grade A")
    assert total == 100.0


# --------------------------------------------------------------------------- #
# validation harness
# --------------------------------------------------------------------------- #

def _mk(db):
    f = User(role="farmer", name="F", phone="+91f", district="Pune", taluka="")
    b = User(role="buyer", name="B", phone="+91b", district="Pune", taluka="")
    db.add_all([f, b]); db.flush()
    lot = Lot(farmer_id=f.id, crop="Onion", quantity_kg=500, quality_grade="A",
              expected_price=2400, available_from=date.today(), location="Pune", status="open")
    dem = Demand(buyer_id=b.id, crop="Onion", quantity_kg=500, quality_spec="Grade A",
                 price_band_min=2000, price_band_max=2800, delivery_window="Within 7 days",
                 status="open")
    db.add_all([lot, dem]); db.commit()
    return lot, dem


def test_matching_health_reports_consistent(db):
    _mk(db)
    run_matching(db)
    h = matching_health(db)
    assert h["total_matches"] == 1
    assert h["buckets"]["consistent"] == 1
    assert h["precision"] == 1.0 and h["healthy"] is True


def test_matching_health_flags_degraded_after_change(db):
    lot, dem = _mk(db)
    run_matching(db)
    # the buyer relocates far away and cuts the order to a sliver, well below
    # the lot's expected price -> quantity+price+distance all collapse.
    buyer = db.query(User).filter(User.role == "buyer").one()
    buyer.district = "Gadchiroli"
    dem.quantity_kg = 10
    dem.price_band_min = 300
    dem.price_band_max = 500
    db.commit()
    h = matching_health(db)
    assert h["buckets"]["degraded"] == 1
    assert h["precision"] < 1.0 and h["healthy"] is False


def test_matching_health_flags_orphaned(db):
    lot, dem = _mk(db)
    run_matching(db)
    db.delete(lot); db.commit()
    h = matching_health(db)
    assert h["buckets"]["orphaned"] == 1 and h["healthy"] is False


# --------------------------------------------------------------------------- #
# incremental matching (match_lot / match_demand) + stale-match retirement
# --------------------------------------------------------------------------- #

def test_match_lot_incrementally_creates_match(db):
    from app.models.match import Match
    from app.services.matching import match_lot

    lot, dem = _mk(db)
    n = match_lot(db, lot)              # no full run_matching()
    assert n == 1
    m = db.query(Match).one()
    assert m.lot_id == lot.id and m.demand_id == dem.id and m.status == "proposed"


def test_match_demand_incrementally_creates_match(db):
    from app.models.match import Match
    from app.services.matching import match_demand

    lot, dem = _mk(db)
    assert match_demand(db, dem) == 1
    assert db.query(Match).count() == 1


def test_editing_a_lot_out_of_range_retires_the_match(db):
    from app.models.match import Match
    from app.services.matching import match_lot

    lot, dem = _mk(db)
    match_lot(db, lot)
    assert db.query(Match).filter(Match.status == "proposed").count() == 1

    # farmer moves the lot 900 km away and drops it to a sliver of the order
    # AND way outside the price band -> distance, quantity and price all
    # collapse and the pair no longer scores >= MIN_SCORE.
    lot.location = "Gadchiroli"
    lot.latitude = lot.longitude = None
    lot.quantity_kg = 60
    lot.expected_price = 9000
    db.commit()
    match_lot(db, lot)

    m = db.query(Match).one()
    assert m.status == "rejected"          # stale proposal retired, not left stale


def test_run_matching_also_retires_a_degraded_proposal(db):
    from app.models.match import Match
    from app.services.matching import run_matching

    lot, dem = _mk(db)
    run_matching(db)
    buyer = db.query(User).filter(User.role == "buyer").one()
    buyer.district = "Gadchiroli"
    dem.price_band_min = 100
    dem.price_band_max = 200
    dem.quantity_kg = 5
    db.commit()
    run_matching(db)
    assert db.query(Match).one().status == "rejected"
