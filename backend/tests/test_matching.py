"""Tests for the match scoring service and the matching endpoints."""

from datetime import date

import pytest
from sqlalchemy import select

from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.services.matching import (
    MIN_SCORE,
    _distance_score,
    _price_score,
    _quantity_score,
    run_matching,
    score_pair,
)

# ---------------------------------------------------------------------------
# Pure unit tests — no DB
# ---------------------------------------------------------------------------

class TestQuantityScore:
    def test_perfect_match(self):
        assert _quantity_score(500, 500) == 30.0

    def test_half_match(self):
        # 500/1000 = 0.5 × 30 = 15
        assert _quantity_score(500, 1000) == 15.0

    def test_symmetric(self):
        assert _quantity_score(300, 900) == _quantity_score(900, 300)

    def test_zero_qty_returns_zero(self):
        assert _quantity_score(0, 500) == 0.0


class TestPriceScore:
    def test_within_band_full_score(self):
        assert _price_score(2400, 2000, 2800) == 40.0

    def test_at_band_min_full_score(self):
        assert _price_score(2000, 2000, 2800) == 40.0

    def test_at_band_max_full_score(self):
        assert _price_score(2800, 2000, 2800) == 40.0

    def test_outside_band_zero(self):
        # expected far above band
        assert _price_score(5000, 2000, 2800) == 0.0

    def test_partial_credit_just_outside(self):
        # gap = 200, band_width = 800, fraction = 1 - 200/800 = 0.75 → 30.0
        score = _price_score(1800, 2000, 2800)
        assert 0 < score < 40

    def test_point_price_exact_match(self):
        assert _price_score(2000, 2000, 2000) == 40.0

    def test_point_price_no_match(self):
        assert _price_score(2001, 2000, 2000) == 0.0


class TestDistanceScore:
    def test_nearby_full_score(self):
        # Pune → Pune = 0 km
        assert _distance_score("Pune", "Pune") == 30.0

    def test_medium_distance(self):
        # Pune → Nashik ≈ 164 km → 151–300 bracket → 10 pts
        assert _distance_score("Pune", "Nashik") == 10.0

    def test_far_distance_zero(self):
        # Pune → Gadchiroli > 300 km
        assert _distance_score("Pune", "Gadchiroli") == 0.0

    def test_unknown_centroid_neutral(self):
        assert _distance_score("UnknownPlace", "Pune") == 15.0

    def test_both_unknown_neutral(self):
        assert _distance_score("Unknown", "AlsoUnknown") == 15.0


class TestScorePair:
    def test_perfect_score(self):
        total, detail = score_pair(
            lot_qty=500, lot_expected_price=2400, lot_location="Pune",
            demand_qty=500, demand_band_min=2000, demand_band_max=2800,
            buyer_district="Pune",
        )
        assert total == 100.0
        assert '"total": 100.0' in detail

    def test_detail_json_has_all_keys(self):
        _, detail = score_pair(500, 2400, "Pune", 500, 2000, 2800, "Pune")
        import json
        d = json.loads(detail)
        assert {"quantity", "price", "distance", "base", "quality_factor",
                "timing_factor", "total", "max", "tier"} <= set(d.keys())

    def test_max_is_100(self):
        import json
        _, detail = score_pair(500, 2400, "Pune", 500, 2000, 2800, "Nashik")
        assert json.loads(detail)["max"] == 100


# ---------------------------------------------------------------------------
# Integration tests — use the db fixture
# ---------------------------------------------------------------------------

def _make_lot(db, farmer, crop="Onion", qty=500, price=2400, location="Pune"):
    lot = Lot(
        farmer_id=farmer.id, crop=crop, quantity_kg=qty,
        quality_grade="A", expected_price=price, location=location,
        available_from=date(2026, 10, 1), status="open",
    )
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return lot


def _make_demand(db, buyer, crop="Onion", qty=600, band_min=2000, band_max=2800):
    demand = Demand(
        buyer_id=buyer.id, crop=crop, quantity_kg=qty,
        quality_spec="Grade A", price_band_min=band_min, price_band_max=band_max,
        delivery_window="7 days", status="open",
    )
    db.add(demand)
    db.commit()
    db.refresh(demand)
    return demand


class TestRunMatching:
    def test_creates_match_for_compatible_pair(self, db, farmer_user, buyer_user):
        _make_lot(db, farmer_user)
        _make_demand(db, buyer_user)
        count = run_matching(db)
        assert count == 1
        matches = db.execute(select(Match)).scalars().all()
        assert len(matches) == 1
        assert matches[0].score >= MIN_SCORE
        assert matches[0].status == "proposed"

    def test_score_detail_stored(self, db, farmer_user, buyer_user):
        _make_lot(db, farmer_user)
        _make_demand(db, buyer_user)
        run_matching(db)
        match = db.execute(select(Match)).scalar_one()
        assert match.score_detail is not None
        import json
        d = json.loads(match.score_detail)
        assert "total" in d

    def test_skips_below_threshold(self, db, farmer_user, buyer_user):
        # Price wildly incompatible (0 pts) + buyer far away (0 pts) + qty partial (~25 pts)
        # Total ≈ 25 pts < MIN_SCORE=30 → no match created
        # To guarantee < 30: set buyer district far away AND bad price band
        buyer_user.district = "Gadchiroli"  # >300 km from Pune → 0 distance pts
        db.commit()
        _make_lot(db, farmer_user, price=10_000, location="Pune")
        _make_demand(db, buyer_user, band_min=100, band_max=200)
        count = run_matching(db)
        assert count == 0
        assert db.execute(select(Match)).scalars().first() is None

    def test_different_crops_no_match(self, db, farmer_user, buyer_user):
        _make_lot(db, farmer_user, crop="Onion")
        _make_demand(db, buyer_user, crop="Tomato")
        count = run_matching(db)
        assert count == 0

    def test_crop_match_is_case_insensitive(self, db, farmer_user, buyer_user):
        _make_lot(db, farmer_user, crop="onion")
        _make_demand(db, buyer_user, crop="ONION")
        count = run_matching(db)
        assert count == 1

    def test_upserts_existing_proposed_match(self, db, farmer_user, buyer_user):
        lot = _make_lot(db, farmer_user)
        demand = _make_demand(db, buyer_user)
        run_matching(db)
        run_matching(db)  # second run should upsert, not duplicate
        matches = db.execute(select(Match)).scalars().all()
        assert len(matches) == 1

    def test_does_not_touch_accepted_match(self, db, farmer_user, buyer_user):
        lot = _make_lot(db, farmer_user)
        demand = _make_demand(db, buyer_user)
        run_matching(db)
        # Manually accept the match
        match = db.execute(select(Match)).scalar_one()
        original_score = match.score
        match.status = "accepted"
        db.commit()
        # Change lot price to something different
        lot.expected_price = 9999
        db.commit()
        run_matching(db)
        db.expire_all()
        match = db.execute(select(Match)).scalar_one()
        # Score should be unchanged because accepted matches are not re-scored
        assert match.score == original_score


# ---------------------------------------------------------------------------
# Endpoint integration tests
# ---------------------------------------------------------------------------

class TestGetMatchesMine:
    def test_farmer_sees_own_matches(self, db, farmer_client, farmer_user, buyer_user):
        _make_lot(db, farmer_user)
        _make_demand(db, buyer_user)
        run_matching(db)

        resp = farmer_client.get("/api/matches/mine")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["lot"]["crop"] == "Onion"
        assert data[0]["score_detail"] is not None

    def test_buyer_sees_own_matches(self, db, buyer_client, farmer_user, buyer_user):
        _make_lot(db, farmer_user)
        _make_demand(db, buyer_user)
        run_matching(db)

        resp = buyer_client.get("/api/matches/mine")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["demand"]["crop"] == "Onion"

    def test_matches_ordered_by_score_desc(self, db, farmer_client, farmer_user, buyer_user):
        from app.models.user import User
        # Create a second buyer with a far-away district to get a lower score
        buyer2 = User(role="buyer", name="B2", phone="+919999999999",
                      district="Gadchiroli", taluka="Gadchiroli",
                      kyc_status="unverified", is_active=True)
        db.add(buyer2)
        db.commit()
        db.refresh(buyer2)

        _make_lot(db, farmer_user)
        _make_demand(db, buyer_user)  # close match (Nashik buyer)
        _make_demand(db, buyer2, band_min=2000, band_max=2800)  # same price band, far away
        run_matching(db)

        resp = farmer_client.get("/api/matches/mine")
        assert resp.status_code == 200
        scores = [m["score"] for m in resp.json()]
        assert len(scores) >= 1
        assert scores == sorted(scores, reverse=True)

    def test_counterparty_included(self, db, farmer_client, farmer_user, buyer_user):
        _make_lot(db, farmer_user)
        _make_demand(db, buyer_user)
        run_matching(db)

        resp = farmer_client.get("/api/matches/mine")
        data = resp.json()
        cp = data[0]["counterparty"]
        assert cp is not None
        assert cp["name"] == buyer_user.name
        assert cp["kyc_status"] == "verified"  # buyer_user fixture has kyc_status=verified

    def test_no_auth_returns_401(self, auth_client):
        resp = auth_client.get("/api/matches/mine")
        assert resp.status_code == 401
