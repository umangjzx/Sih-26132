"""Diesel-indexed road-freight rate (v1.5).

Replaces the flat ``transport_cost_per_qtl_km`` constant with an *explainable*
figure:

    rate ₹/qtl/km  =  handling_base  +  diesel ₹/L ÷ (truck_kmpl × quintals_per_truck)

The diesel price is a curated per-state reference (retail rack, updated
periodically — state VAT makes it vary 87-100 ₹/L). Everything else is a fixed,
inspectable assumption for a mid-size 9-tonne truck. The number lands near the
old 0.40 constant, so this refines rather than disrupts the "best market" and
deal-logistics maths.
"""

from __future__ import annotations

from datetime import date

# --- fixed truck assumptions ------------------------------------------------
HANDLING_BASE = 0.15        # ₹/qtl/km — loading, unloading, tolls, driver, wear
TRUCK_KMPL = 4.0            # laden mileage of a 9-tonne truck
QUINTALS_PER_TRUCK = 90.0   # ~9 t payload

# --- curated diesel reference (₹/L), indicative — as of Sep 2026 ----------
DIESEL_AS_OF = date(2026, 9, 1)
DIESEL_INR_PER_L: dict[str, float] = {
    "Andhra Pradesh": 97.5, "Arunachal Pradesh": 88.6, "Assam": 90.4,
    "Bihar": 92.3, "Chhattisgarh": 92.9, "Goa": 88.5, "Gujarat": 90.0,
    "Haryana": 88.3, "Himachal Pradesh": 90.4, "Jharkhand": 92.0,
    "Karnataka": 91.0, "Kerala": 96.2, "Madhya Pradesh": 93.9,
    "Maharashtra": 92.2, "Manipur": 94.5, "Meghalaya": 91.4,
    "Mizoram": 90.0, "Nagaland": 91.0, "Odisha": 92.6, "Punjab": 88.4,
    "Rajasthan": 93.5, "Sikkim": 94.3, "Tamil Nadu": 94.6,
    "Telangana": 97.8, "Tripura": 89.8, "Uttar Pradesh": 89.9,
    "Uttarakhand": 90.9, "West Bengal": 92.8,
    "Delhi": 87.7, "Jammu and Kashmir": 92.9, "Ladakh": 96.0,
    "Puducherry": 89.4, "Chandigarh": 87.3,
    "Andaman and Nicobar Islands": 88.0,
    "Dadra and Nagar Haveli and Daman and Diu": 90.0, "Lakshadweep": 96.0,
}
_DIESEL_DEFAULT = 92.0      # national-ish average when a state isn't listed


def diesel_price(state: str | None) -> float:
    return DIESEL_INR_PER_L.get((state or "").strip(), _DIESEL_DEFAULT)


def freight_rate(state: str | None) -> dict:
    """₹/qtl/km freight rate for a route originating in ``state`` (diesel varies
    by state; the rest is fixed). Returns the rate plus its breakdown so the UI
    can show the working."""
    d = diesel_price(state)
    fuel = d / (TRUCK_KMPL * QUINTALS_PER_TRUCK)
    rate = round(HANDLING_BASE + fuel, 3)
    return {
        "rate_per_qtl_km": rate,
        "diesel_inr_per_l": round(d, 2),
        "truck_kmpl": TRUCK_KMPL,
        "quintals_per_truck": QUINTALS_PER_TRUCK,
        "breakdown": {"handling": HANDLING_BASE, "fuel": round(fuel, 3)},
        "source": "diesel: curated per-state reference (retail rack)",
        "as_of": DIESEL_AS_OF.isoformat(),
    }


def estimate_cost(state: str | None, distance_km: float | None, quantity_kg: float) -> dict:
    """Full freight estimate for moving ``quantity_kg`` over ``distance_km``."""
    r = freight_rate(state)
    est_total = None
    if distance_km is not None and quantity_kg > 0:
        est_total = round(distance_km * r["rate_per_qtl_km"] * (quantity_kg / 100.0), 0)
    return {**r, "distance_km": distance_km, "est_total_inr": est_total}
