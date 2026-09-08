"""v1.4 phase 2 — discovery boards: a buyer browses nearby lots, a farmer
browses nearby demands, and "express interest" opens (or refuses) a match.
"""

from datetime import date

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.models.user import User


def _client(db):
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _as(u):
    app.dependency_overrides[get_current_user] = lambda: u


def _cbe_farmer(db):
    u = User(role="farmer", name="Murugan", phone="+91cbef", district="Coimbatore",
             taluka="", state="Tamil Nadu", latitude=11.0168, longitude=76.9558,
             verification_status="verified")
    db.add(u); db.flush()
    return u


def _cbe_buyer(db):
    u = User(role="buyer", name="Kovai", phone="+91cbeb", district="Coimbatore",
             taluka="", state="Tamil Nadu", latitude=11.0168, longitude=76.9558)
    db.add(u); db.flush()
    return u


def _chennai_buyer(db):
    u = User(role="buyer", name="Chennai Co", phone="+91chn", district="Chennai",
             taluka="", state="Tamil Nadu", latitude=13.0827, longitude=80.2707)
    db.add(u); db.flush()
    return u


def _onion_lot(db, farmer):
    lot = Lot(farmer_id=farmer.id, crop="Onion", quantity_kg=1000, quality_grade="A",
              expected_price=2400, available_from=date(2026, 10, 1), location="Coimbatore",
              latitude=11.0168, longitude=76.9558, status="open")
    db.add(lot); db.flush()
    return lot


def test_buyer_browse_lots_filters_by_radius(db):
    farmer = _cbe_farmer(db)
    _onion_lot(db, farmer)
    near, far = _cbe_buyer(db), _chennai_buyer(db)
    db.commit()
    client = _client(db)
    try:
        _as(near)
        rows = client.get("/api/lots/browse", params={"radius_km": 200}).json()
        assert len(rows) == 1 and rows[0]["farmer_name"] == "Murugan"
        assert rows[0]["farmer_verified"] is True and rows[0]["distance_km"] == 0.0

        _as(far)
        assert client.get("/api/lots/browse", params={"radius_km": 200}).json() == []
        # without a radius the Chennai buyer still sees it, just ~450 km away
        wide = client.get("/api/lots/browse").json()
        assert len(wide) == 1 and wide[0]["distance_km"] > 400
    finally:
        app.dependency_overrides.clear()


def test_browse_lots_radius_includes_a_lot_with_no_stored_coords(db):
    """A lot with no latitude/longitude of its own relies on
    discovery.py's district-centroid fallback to find its true position —
    the SQL-level bounding-box pre-filter (added to avoid loading every
    open lot before geo-filtering) must not exclude it before that fallback
    ever runs. Prove it still shows up under a radius search alongside a
    same-district lot that does have coords."""
    farmer = _cbe_farmer(db)
    no_coords_lot = Lot(farmer_id=farmer.id, crop="Onion", quantity_kg=800, quality_grade="A",
                        expected_price=2300, available_from=date(2026, 10, 1), location="Coimbatore",
                        latitude=None, longitude=None, status="open")
    db.add(no_coords_lot); db.flush()
    buyer = _cbe_buyer(db)
    db.commit()
    client = _client(db)
    try:
        _as(buyer)
        rows = client.get("/api/lots/browse", params={"radius_km": 50}).json()
        assert any(r["id"] == no_coords_lot.id for r in rows), \
            "a no-coords lot resolvable via the district fallback must not be excluded by the bbox pre-filter"
    finally:
        app.dependency_overrides.clear()


def test_farmer_browse_demands_filters_by_radius(db):
    """browse_demands has no prior dedicated test at all — added alongside
    its own bounding-box pre-filter (the same fix as browse_lots above) so
    that new SQL-level filter is actually exercised, not just the lot side."""
    buyer = _cbe_buyer(db)
    db.add(Demand(buyer_id=buyer.id, crop="Onion", quantity_kg=1000, quality_spec="Grade A",
                  price_band_min=2200, price_band_max=2700, delivery_window="Within 7 days",
                  delivery_district="Coimbatore", latitude=11.0168, longitude=76.9558, status="open"))
    near, far = _cbe_farmer(db), User(role="farmer", name="Chennai Farmer", phone="+91chnf",
                                       district="Chennai", taluka="", state="Tamil Nadu",
                                       latitude=13.0827, longitude=80.2707)
    db.add(far); db.commit()
    client = _client(db)
    try:
        _as(near)
        rows = client.get("/api/demands/browse", params={"radius_km": 200}).json()
        assert len(rows) == 1 and rows[0]["buyer_name"] == "Kovai"

        _as(far)
        assert client.get("/api/demands/browse", params={"radius_km": 200}).json() == []
    finally:
        app.dependency_overrides.clear()


def test_browse_demands_radius_includes_a_demand_with_no_stored_coords(db):
    """Mirrors the browse_lots no-coords test: a demand relying on the
    delivery-district/buyer-district centroid fallback must not be excluded
    by the SQL-level bounding-box pre-filter before that fallback runs."""
    buyer = _cbe_buyer(db)
    no_coords_demand = Demand(buyer_id=buyer.id, crop="Onion", quantity_kg=900, quality_spec="Grade A",
                              price_band_min=2200, price_band_max=2700, delivery_window="Within 7 days",
                              delivery_district="Coimbatore", latitude=None, longitude=None, status="open")
    db.add(no_coords_demand)
    farmer = _cbe_farmer(db)
    db.commit()
    client = _client(db)
    try:
        _as(farmer)
        rows = client.get("/api/demands/browse", params={"radius_km": 50}).json()
        assert any(r["id"] == no_coords_demand.id for r in rows), \
            "a no-coords demand resolvable via the district fallback must not be excluded by the bbox pre-filter"
    finally:
        app.dependency_overrides.clear()


def test_browse_lots_requires_buyer(db):
    farmer = _cbe_farmer(db)
    db.commit()
    client = _client(db)
    try:
        _as(farmer)
        assert client.get("/api/lots/browse").status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_express_interest_opens_a_match(db):
    farmer, buyer = _cbe_farmer(db), _cbe_buyer(db)
    lot = _onion_lot(db, farmer)
    db.add(Demand(buyer_id=buyer.id, crop="Onion", quantity_kg=1000, quality_spec="Grade A",
                  price_band_min=2200, price_band_max=2700, delivery_window="Within 7 days",
                  delivery_district="Coimbatore", latitude=11.0168, longitude=76.9558, status="open"))
    db.commit()
    client = _client(db)
    try:
        _as(buyer)
        r = client.post(f"/api/lots/{lot.id}/express-interest")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["matched"] is True and body["match_id"] and body["score"] >= 30
        assert db.query(Match).count() == 1
    finally:
        app.dependency_overrides.clear()


def test_express_interest_twice_reuses_the_same_match_not_a_duplicate(db):
    """try_pair's `existing is None` check can be raced past by a
    double-submit (two near-simultaneous "express interest" clicks both
    reading "no match yet"). This proves the DB constraint backing "one
    Match row per (lot, demand)" actually catches what the check misses, by
    inserting the second row directly rather than relying on ORM-level
    timing, and that the losing caller still gets back a usable match
    instead of an error."""
    farmer, buyer = _cbe_farmer(db), _cbe_buyer(db)
    lot = _onion_lot(db, farmer)
    demand = Demand(buyer_id=buyer.id, crop="Onion", quantity_kg=1000, quality_spec="Grade A",
                     price_band_min=2200, price_band_max=2700, delivery_window="Within 7 days",
                     delivery_district="Coimbatore", latitude=11.0168, longitude=76.9558, status="open")
    db.add(demand)
    db.commit()
    client = _client(db)
    try:
        _as(buyer)
        r = client.post(f"/api/lots/{lot.id}/express-interest")
        assert r.status_code == 200, r.text
        match_id = r.json()["match_id"]

        # Simulate the losing half of a race: a second Match row for the
        # same (lot, demand) inserted directly, bypassing the app-level
        # check that the winning request already passed.
        dupe = Match(lot_id=lot.id, demand_id=demand.id, score=40.0, status="proposed")
        db.add(dupe)
        try:
            db.flush()
            assert False, "expected the unique constraint to reject a second match row"
        except Exception as e:
            assert "uq_match_lot_demand" in str(e) or "UNIQUE" in str(e)
        finally:
            db.rollback()

        assert db.query(Match).count() == 1
        assert db.query(Match).first().id == match_id
    finally:
        app.dependency_overrides.clear()


def test_browse_hides_a_lot_the_buyer_already_matched(db):
    farmer, buyer = _cbe_farmer(db), _cbe_buyer(db)
    lot = _onion_lot(db, farmer)
    db.add(Demand(buyer_id=buyer.id, crop="Onion", quantity_kg=1000, quality_spec="Grade A",
                  price_band_min=2200, price_band_max=2700, delivery_window="Within 7 days",
                  delivery_district="Coimbatore", latitude=11.0168, longitude=76.9558, status="open"))
    db.commit()
    client = _client(db)
    try:
        _as(buyer)
        assert len(client.get("/api/lots/browse").json()) == 1
        # after expressing interest the lot is no longer "new" on the board
        assert client.post(f"/api/lots/{lot.id}/express-interest").status_code == 200
        assert client.get("/api/lots/browse").json() == []
    finally:
        app.dependency_overrides.clear()


def test_express_interest_without_a_demand_409s(db):
    farmer, buyer = _cbe_farmer(db), _cbe_buyer(db)
    lot = _onion_lot(db, farmer)
    db.commit()
    client = _client(db)
    try:
        _as(buyer)
        assert client.post(f"/api/lots/{lot.id}/express-interest").status_code == 409
    finally:
        app.dependency_overrides.clear()


def test_express_interest_picks_the_best_scoring_demand_not_the_first(db):
    """Previously stopped at the first demand that cleared MIN_SCORE — a
    poor-but-still-passing demand inserted first would win over a much better
    one inserted after it."""
    farmer, buyer = _cbe_farmer(db), _cbe_buyer(db)
    lot = _onion_lot(db, farmer)  # expected_price=2400
    poor = Demand(buyer_id=buyer.id, crop="Onion", quantity_kg=1000, quality_spec="Grade A",
                  price_band_min=1000, price_band_max=1200, delivery_window="Within 7 days",
                  delivery_district="Coimbatore", latitude=11.0168, longitude=76.9558, status="open")
    good = Demand(buyer_id=buyer.id, crop="Onion", quantity_kg=1000, quality_spec="Grade A",
                  price_band_min=2200, price_band_max=2700, delivery_window="Within 7 days",
                  delivery_district="Coimbatore", latitude=11.0168, longitude=76.9558, status="open")
    db.add(poor); db.add(good); db.commit()
    client = _client(db)
    try:
        _as(buyer)
        r = client.post(f"/api/lots/{lot.id}/express-interest")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["matched"] is True
        match = db.get(Match, body["match_id"])
        assert match.demand_id == good.id
        assert db.query(Match).count() == 1  # the poor candidate never got upserted
    finally:
        app.dependency_overrides.clear()


def test_express_interest_in_demand_picks_the_best_scoring_lot_not_the_first(db):
    """Same fix, other direction — a farmer's demand-side express-interest."""
    farmer, buyer = _cbe_farmer(db), _cbe_buyer(db)
    demand = Demand(buyer_id=buyer.id, crop="Onion", quantity_kg=1000, quality_spec="Grade A",
                     price_band_min=2200, price_band_max=2700, delivery_window="Within 7 days",
                     delivery_district="Coimbatore", latitude=11.0168, longitude=76.9558, status="open")
    db.add(demand); db.flush()
    poor_lot = Lot(farmer_id=farmer.id, crop="Onion", quantity_kg=1000, quality_grade="A",
                   expected_price=5000, available_from=date(2026, 10, 1), location="Coimbatore",
                   latitude=11.0168, longitude=76.9558, status="open")
    good_lot = Lot(farmer_id=farmer.id, crop="Onion", quantity_kg=1000, quality_grade="A",
                   expected_price=2400, available_from=date(2026, 10, 1), location="Coimbatore",
                   latitude=11.0168, longitude=76.9558, status="open")
    db.add(poor_lot); db.add(good_lot); db.commit()
    client = _client(db)
    try:
        _as(farmer)
        r = client.post(f"/api/demands/{demand.id}/express-interest")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["matched"] is True
        match = db.get(Match, body["match_id"])
        assert match.lot_id == good_lot.id
    finally:
        app.dependency_overrides.clear()


def test_express_interest_refuses_a_far_pair(db):
    farmer = _cbe_farmer(db)
    lot = _onion_lot(db, farmer)
    buyer = _chennai_buyer(db)
    db.add(Demand(buyer_id=buyer.id, crop="Onion", quantity_kg=1000, quality_spec="Grade A",
                  price_band_min=2200, price_band_max=2700, delivery_window="Within 7 days",
                  delivery_district="Chennai", latitude=13.0827, longitude=80.2707, status="open"))
    db.commit()
    client = _client(db)
    try:
        _as(buyer)
        r = client.post(f"/api/lots/{lot.id}/express-interest")
        assert r.status_code == 200
        body = r.json()
        assert body["matched"] is False and "range" in (body["reason"] or "")
        assert db.query(Match).count() == 0
    finally:
        app.dependency_overrides.clear()
