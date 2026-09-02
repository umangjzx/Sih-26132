"""Diesel-indexed freight rate (v1.5)."""

from app.services.freight import (
    HANDLING_BASE,
    QUINTALS_PER_TRUCK,
    TRUCK_KMPL,
    diesel_price,
    estimate_cost,
    freight_rate,
)


def test_diesel_price_known_and_default():
    assert diesel_price("Tamil Nadu") == 94.6
    assert diesel_price("Maharashtra") == 92.2
    # unknown / blank falls back to the national-ish default
    assert diesel_price("Neverland") == 92.0
    assert diesel_price(None) == 92.0
    assert diesel_price("  Tamil Nadu  ") == 94.6


def test_freight_rate_breakdown_sums_to_rate():
    r = freight_rate("Tamil Nadu")
    b = r["breakdown"]
    assert round(b["handling"] + b["fuel"], 3) == r["rate_per_qtl_km"]
    assert b["handling"] == HANDLING_BASE
    # fuel component = diesel / (kmpl * qtl_per_truck)
    assert b["fuel"] == round(94.6 / (TRUCK_KMPL * QUINTALS_PER_TRUCK), 3)


def test_freight_rate_lands_near_the_old_constant():
    # the old flat rate was 0.40 ₹/qtl/km — the indexed one should refine, not disrupt
    for state in ("Maharashtra", "Tamil Nadu", "Punjab", "Telangana", None):
        rate = freight_rate(state)["rate_per_qtl_km"]
        assert 0.35 <= rate <= 0.45, (state, rate)


def test_higher_diesel_state_costs_more():
    assert (
        freight_rate("Telangana")["rate_per_qtl_km"]
        > freight_rate("Delhi")["rate_per_qtl_km"]
    )


def test_estimate_cost_total_math():
    r = freight_rate("Maharashtra")
    est = estimate_cost("Maharashtra", distance_km=200.0, quantity_kg=1000.0)
    assert est["est_total_inr"] == round(200.0 * r["rate_per_qtl_km"] * 10.0, 0)
    assert est["distance_km"] == 200.0


def test_estimate_cost_no_distance_is_none():
    est = estimate_cost("Maharashtra", distance_km=None, quantity_kg=1000.0)
    assert est["est_total_inr"] is None
    # rate + breakdown still present so the UI can show the working
    assert est["rate_per_qtl_km"] > 0


def test_freight_rate_endpoint_shape(client):
    resp = client.get("/api/logistics/freight-rate", params={"from_state": "Tamil Nadu"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["diesel_inr_per_l"] == 94.6
    assert body["rate_per_qtl_km"] > 0
    assert "breakdown" in body and "as_of" in body


def test_freight_rate_endpoint_district_pair_distance(client):
    resp = client.get(
        "/api/logistics/freight-rate",
        params={"from_district": "Coimbatore", "to_district": "Erode", "quantity_kg": 2000},
    )
    assert resp.status_code == 200
    body = resp.json()
    # Coimbatore -> Erode is ~90 km straight line
    assert body["distance_km"] is not None and 40 < body["distance_km"] < 160
    # state is inferred from the district centroid (Coimbatore sits near the
    # TN/Kerala border, so either state's diesel figure is acceptable here)
    assert 90 < body["diesel_inr_per_l"] < 100
    assert body["est_total_inr"] > 0
