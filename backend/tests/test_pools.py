"""Group / pooled requests — aggregation + buyer-demand matching."""

import pytest

from app.models.demand import Demand
from app.models.pool import Pool, PoolMember
from app.models.user import User
from app.services.pools import aggregate, demand_candidates


# --------------------------------------------------------------------------- #
# pure aggregation
# --------------------------------------------------------------------------- #

def test_aggregate_weighted_price_and_fill():
    pool = Pool(crop="Onion", title="t", target_quantity_kg=1000, floor_price=2000, grade="B")
    members = [
        PoolMember(quantity_kg=300, expected_price=2400, status="committed"),
        PoolMember(quantity_kg=200, expected_price=2000, status="committed"),
        PoolMember(quantity_kg=999, expected_price=9999, status="withdrawn"),  # ignored
    ]
    agg = aggregate(pool, members)
    assert agg["members"] == 2
    assert agg["quantity_kg"] == 500
    # (300*2400 + 200*2000) / 500 = 2240
    assert agg["weighted_price"] == 2240.0
    assert agg["effective_price"] == 2240.0
    assert agg["fill_pct"] == 50.0


def test_aggregate_floor_price_applies():
    pool = Pool(crop="Onion", title="t", target_quantity_kg=1000, floor_price=2500, grade="B")
    members = [PoolMember(quantity_kg=400, expected_price=2100, status="committed")]
    agg = aggregate(pool, members)
    assert agg["weighted_price"] == 2100.0
    assert agg["effective_price"] == 2500.0  # floored


def test_aggregate_empty_pool():
    pool = Pool(crop="Onion", title="t", target_quantity_kg=1000, floor_price=2000, grade="B")
    agg = aggregate(pool, [])
    assert agg["quantity_kg"] == 0
    assert agg["effective_price"] == 2000.0


# --------------------------------------------------------------------------- #
# demand candidates (DB)
# --------------------------------------------------------------------------- #

def _buyer(db, district="Pune"):
    b = User(role="buyer", name="Big Buyer", phone=f"+91{district}", district=district, taluka="")
    db.add(b); db.flush()
    return b


def test_demand_candidates_ranks_and_filters_by_crop(db):
    pool = Pool(organizer_id=1, crop="Onion", title="Kharif onion pool",
                target_quantity_kg=2000, floor_price=2000, grade="B", location="Pune")
    db.add(pool); db.flush()
    members = [
        PoolMember(pool_id=pool.id, farmer_id=1, quantity_kg=1200, expected_price=2300, status="committed"),
        PoolMember(pool_id=pool.id, farmer_id=2, quantity_kg=800, expected_price=2200, status="committed"),
    ]
    db.add_all(members)

    b1 = _buyer(db, "Pune")
    b2 = _buyer(db, "Nagpur")
    db.add_all([
        Demand(buyer_id=b1.id, crop="Onion", quantity_kg=2000, quality_spec="Grade B",
               price_band_min=2000, price_band_max=2600, delivery_window="Within 10 days", status="open"),
        Demand(buyer_id=b2.id, crop="Tomato", quantity_kg=2000, quality_spec="",
               price_band_min=2000, price_band_max=2600, delivery_window="", status="open"),
    ])
    db.commit()

    cands = demand_candidates(db, pool, members)
    assert len(cands) == 1                     # tomato demand filtered out
    assert cands[0]["buyer_name"] == "Big Buyer"
    assert cands[0]["tier"] in {"strong", "good", "fair", "weak"}
    assert cands[0]["score"] > 0


def test_demand_candidates_empty_when_no_committed_quantity(db):
    pool = Pool(organizer_id=1, crop="Onion", title="t", target_quantity_kg=2000,
                floor_price=2000, grade="B", location="Pune")
    db.add(pool); db.flush()
    b1 = _buyer(db)
    db.add(Demand(buyer_id=b1.id, crop="Onion", quantity_kg=2000, quality_spec="",
                  price_band_min=2000, price_band_max=2600, delivery_window="", status="open"))
    db.commit()
    assert demand_candidates(db, pool, []) == []


# --------------------------------------------------------------------------- #
# endpoints
# --------------------------------------------------------------------------- #

def test_buyer_cannot_create_pool(buyer_client):
    assert buyer_client.post("/api/pools", json={
        "crop": "Onion", "title": "x", "target_quantity_kg": 10, "floor_price": 10,
    }).status_code == 403


def test_pool_lifecycle_via_api(farmer_client, db):
    # farmer creates a pool
    r = farmer_client.post("/api/pools", json={
        "crop": "Onion", "title": "Village onion pool",
        "target_quantity_kg": 1000, "floor_price": 2000,
        "grade": "B", "delivery_window": "Within 10 days", "location": "Pune",
    })
    assert r.status_code == 201, r.text
    pid = r.json()["id"]

    # farmer joins their own pool
    r = farmer_client.post(f"/api/pools/{pid}/join", json={"quantity_kg": 400, "expected_price": 2300})
    assert r.status_code == 200
    assert r.json()["status"] == "committed"

    # detail shows the aggregate and (organizer-only) candidates key
    r = farmer_client.get(f"/api/pools/{pid}")
    assert r.status_code == 200
    body = r.json()
    assert body["aggregate"]["quantity_kg"] == 400
    assert body["aggregate"]["effective_price"] == 2300
    assert body["is_organizer"] is True
    assert "candidates" in body

    # list (open pools) includes it
    r = farmer_client.get("/api/pools")
    assert any(p["id"] == pid for p in r.json())

    # organizer locks it; joining now 409s
    assert farmer_client.post(f"/api/pools/{pid}/status", json={"status": "locked"}).status_code == 200
    assert farmer_client.post(f"/api/pools/{pid}/join", json={"quantity_kg": 5, "expected_price": 2100}).status_code == 409


def test_withdraw_marks_member(farmer_client):
    pid = farmer_client.post("/api/pools", json={
        "crop": "Onion", "title": "p", "target_quantity_kg": 1000, "floor_price": 2000,
    }).json()["id"]
    farmer_client.post(f"/api/pools/{pid}/join", json={"quantity_kg": 300, "expected_price": 2200})
    r = farmer_client.post(f"/api/pools/{pid}/withdraw")
    assert r.status_code == 200 and r.json()["status"] == "withdrawn"
    agg = farmer_client.get(f"/api/pools/{pid}").json()["aggregate"]
    assert agg["quantity_kg"] == 0


def test_non_organizer_cannot_change_status(farmer_client, db):
    # organizer is farmer A (the farmer_client fixture user)
    pid = farmer_client.post("/api/pools", json={
        "crop": "Onion", "title": "p", "target_quantity_kg": 1000, "floor_price": 2000,
    }).json()["id"]
    other = User(role="farmer", name="Other", phone="+91other", district="Pune", taluka="")
    db.add(other); db.commit()
    pool = db.get(Pool, pid)
    pool.organizer_id = other.id
    db.commit()
    assert farmer_client.post(f"/api/pools/{pid}/status", json={"status": "closed"}).status_code == 403


# --------------------------------------------------------------------------- #
# v1.4 phase 3 — status guards + pool -> deal handoff
# --------------------------------------------------------------------------- #

def test_pool_status_transition_is_guarded(farmer_client):
    pid = farmer_client.post("/api/pools", json={
        "crop": "Onion", "title": "p", "target_quantity_kg": 1000, "floor_price": 2000,
    }).json()["id"]
    # open -> matched is not a legal jump (must go via locked + a demand)
    assert farmer_client.post(f"/api/pools/{pid}/status", json={"status": "matched"}).status_code == 409
    # open -> closed is fine
    assert farmer_client.post(f"/api/pools/{pid}/status", json={"status": "closed"}).status_code == 200
    # closed -> open is not
    assert farmer_client.post(f"/api/pools/{pid}/status", json={"status": "open"}).status_code == 409


def test_pool_accept_demand_creates_a_deal(farmer_client, db):
    from app.models.pool import Pool
    from app.models.deal import Deal

    pid = farmer_client.post("/api/pools", json={
        "crop": "Onion", "title": "Kongu onion pool", "target_quantity_kg": 5000,
        "floor_price": 2300, "grade": "A", "delivery_window": "Within 2 weeks", "location": "Pune",
    }).json()["id"]
    farmer_client.post(f"/api/pools/{pid}/join", json={"quantity_kg": 2000, "expected_price": 2450})

    buyer = User(role="buyer", name="Bulk Onion Co", phone="+91bulk", district="Pune", taluka="")
    db.add(buyer); db.commit()
    dem = Demand(buyer_id=buyer.id, crop="Onion", quantity_kg=5000, quality_spec="Grade A",
                 price_band_min=2200, price_band_max=2800, delivery_window="Within 2 weeks",
                 delivery_district="Pune", status="open")
    db.add(dem); db.commit()

    r = farmer_client.post(f"/api/pools/{pid}/accept-demand", json={"demand_id": dem.id})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["agreed_quantity_kg"] == 2000
    assert body["agreed_price"] == 2450  # weighted == effective here

    # pool + demand are now matched, the deal exists
    db.expire_all()
    pool = db.get(Pool, pid)
    assert pool.status == "matched" and pool.matched_deal_id == body["deal_id"]
    assert db.get(Demand, dem.id).status == "matched"
    deal = db.get(Deal, body["deal_id"])
    assert deal.agreed_quantity == 2000 and deal.pipeline_status == "matched"

    # members can no longer withdraw
    assert farmer_client.post(f"/api/pools/{pid}/withdraw").status_code == 409


def test_pool_accept_demand_is_farmer_only(buyer_client):
    # role gate fires before anything else — a buyer is 403 regardless of the pool
    assert buyer_client.post("/api/pools/1/accept-demand", json={"demand_id": 1}).status_code == 403


def test_pool_accept_demand_non_organizer_forbidden(farmer_client, db):
    pid = farmer_client.post("/api/pools", json={
        "crop": "Onion", "title": "p", "target_quantity_kg": 1000, "floor_price": 2000,
    }).json()["id"]
    farmer_client.post(f"/api/pools/{pid}/join", json={"quantity_kg": 500, "expected_price": 2200})
    other = User(role="farmer", name="Other", phone="+91other2", district="Pune", taluka="")
    db.add(other); db.commit()
    db.get(Pool, pid).organizer_id = other.id
    db.commit()
    assert farmer_client.post(f"/api/pools/{pid}/accept-demand", json={"demand_id": 1}).status_code == 403
