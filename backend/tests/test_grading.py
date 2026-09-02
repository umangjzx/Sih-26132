"""v1.4 phase 3 — structured quality grading."""

from app.services.grading import GRADE_CODES, normalize_grade
from app.services.matching import quality_factor


def test_normalize_grade():
    assert normalize_grade("A") == "A"
    assert normalize_grade("grade b") == "B"
    assert normalize_grade("Grade-C") == "C"
    assert normalize_grade("FAQ") == "FAQ"
    assert normalize_grade("Fair Average Quality") == "FAQ"
    assert normalize_grade("premium") is None
    assert normalize_grade("") is None
    assert set(GRADE_CODES) == {"A", "B", "FAQ", "C"}


def test_quality_factor_uses_canonical_codes():
    # lot meets/exceeds the buyer's minimum -> no penalty
    assert quality_factor("A", "B") == 1.0
    assert quality_factor("B", "FAQ") == 1.0        # FAQ ~ B
    assert quality_factor("A", "A") == 1.0
    # lot is one grade short -> gentle discount
    assert 0.7 < quality_factor("C", "B") < 1.0
    # two grades short -> bigger discount, floored at 0.6
    assert quality_factor("C", "A") == max(0.6, 1.0 - 0.18 * 2)


def test_lot_create_rejects_unknown_grade(farmer_client):
    r = farmer_client.post("/api/lots/", json={
        "crop": "Onion", "quantity_kg": 500, "quality_grade": "shiny",
        "expected_price": 2400, "available_from": "2026-10-01", "location": "Pune",
    })
    assert r.status_code == 422


def test_demand_grade_min_flows_into_matching(db, farmer_user, buyer_user):
    import json
    from datetime import date

    from app.models.demand import Demand
    from app.models.lot import Lot
    from app.models.match import Match
    from app.services.matching import run_matching

    lot = Lot(farmer_id=farmer_user.id, crop="Onion", quantity_kg=1000, quality_grade="C",
              expected_price=2400, available_from=date(2026, 10, 1), location="Pune", status="open")
    # buyer insists on Grade A via the structured field (spec text says nothing)
    dem = Demand(buyer_id=buyer_user.id, crop="Onion", quantity_kg=1000,
                 quality_spec="clean onions", quality_grade_min="A",
                 price_band_min=2200, price_band_max=2700, delivery_window="7 days",
                 delivery_district="Pune", status="open")
    db.add_all([lot, dem]); db.commit()
    run_matching(db)

    m = db.query(Match).filter(Match.lot_id == lot.id).first()
    assert m is not None
    d = json.loads(m.score_detail)
    assert d["quality_factor"] < 1.0   # C is 2 grades under A


def test_grades_endpoint(auth_client):
    rows = auth_client.get("/api/grades").json()["grades"]
    assert [g["code"] for g in rows] == ["A", "B", "FAQ", "C"]
    assert all("desc" in g for g in rows)
