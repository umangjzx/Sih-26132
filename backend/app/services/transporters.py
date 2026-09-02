"""Transporter directory — curated seed data + nearby lookup.

Seeded once at app startup (idempotent via count check). The list covers the
major agricultural districts of Maharashtra in detail plus a national sample.
Real geography; plausible rates and capacity. Marked as a curated demo sample.
"""

from __future__ import annotations

from app.services.geo import DISTRICT_CENTROIDS, haversine_km

# ── Seed data ────────────────────────────────────────────────────────────────
# Each entry: name, phone, district, state, vehicle_types, rate_per_km_per_qtl,
# max_capacity_tonnes. lat/lon backfilled from district centroid at seed time.

_SEED: list[dict] = [
    # Maharashtra
    {"name": "Satkar Transport (Nashik)", "phone": "9422200001", "district": "Nashik", "state": "Maharashtra", "vehicle_types": "Tractor-trolley, Tempo 407", "rate_per_km_per_qtl": 0.38, "max_capacity_tonnes": 15},
    {"name": "Onion Carriers Pvt Ltd", "phone": "9422200002", "district": "Nashik", "state": "Maharashtra", "vehicle_types": "Mini-truck, Medium truck", "rate_per_km_per_qtl": 0.40, "max_capacity_tonnes": 20},
    {"name": "Pimpalgaon Agro Transport", "phone": "9422200003", "district": "Nashik", "state": "Maharashtra", "vehicle_types": "Tractor-trolley", "rate_per_km_per_qtl": 0.35, "max_capacity_tonnes": 10},
    {"name": "Sahyadri Road Carriers", "phone": "9421300010", "district": "Pune", "state": "Maharashtra", "vehicle_types": "Tempo 407, Mini-truck, Container", "rate_per_km_per_qtl": 0.42, "max_capacity_tonnes": 25},
    {"name": "Baramati Farmers Transport", "phone": "9421300011", "district": "Pune", "state": "Maharashtra", "vehicle_types": "Tractor-trolley, Medium truck", "rate_per_km_per_qtl": 0.36, "max_capacity_tonnes": 12},
    {"name": "Deccan Agri Movers", "phone": "9421300012", "district": "Ahmednagar", "state": "Maharashtra", "vehicle_types": "Tempo 407, Mini-truck", "rate_per_km_per_qtl": 0.39, "max_capacity_tonnes": 18},
    {"name": "Rahuri Cold Chain Transport", "phone": "9421300013", "district": "Ahmednagar", "state": "Maharashtra", "vehicle_types": "Reefer truck", "rate_per_km_per_qtl": 0.55, "max_capacity_tonnes": 8},
    {"name": "Solapur Grain Logistics", "phone": "9420700020", "district": "Solapur", "state": "Maharashtra", "vehicle_types": "Medium truck, Large truck", "rate_per_km_per_qtl": 0.38, "max_capacity_tonnes": 30},
    {"name": "Vidarbha Cotton Carriers", "phone": "7744400030", "district": "Akola", "state": "Maharashtra", "vehicle_types": "Cotton trolley, Medium truck", "rate_per_km_per_qtl": 0.37, "max_capacity_tonnes": 20},
    {"name": "Amravati Citrus Movers", "phone": "7744400031", "district": "Amravati", "state": "Maharashtra", "vehicle_types": "Reefer truck, Tempo 407", "rate_per_km_per_qtl": 0.50, "max_capacity_tonnes": 10},
    {"name": "Nagpur Orange Logistics", "phone": "7122400040", "district": "Nagpur", "state": "Maharashtra", "vehicle_types": "Reefer truck, Container", "rate_per_km_per_qtl": 0.48, "max_capacity_tonnes": 15},
    {"name": "Marathwada Farm Movers", "phone": "9403400050", "district": "Chhatrapati Sambhajinagar", "state": "Maharashtra", "vehicle_types": "Medium truck, Tractor-trolley", "rate_per_km_per_qtl": 0.40, "max_capacity_tonnes": 20},
    {"name": "Latur Soybean Transport", "phone": "9403400051", "district": "Latur", "state": "Maharashtra", "vehicle_types": "Medium truck", "rate_per_km_per_qtl": 0.38, "max_capacity_tonnes": 25},
    {"name": "Jalgaon Banana Cold Carriers", "phone": "9422500060", "district": "Jalgaon", "state": "Maharashtra", "vehicle_types": "Reefer truck", "rate_per_km_per_qtl": 0.52, "max_capacity_tonnes": 12},
    {"name": "Sangli Turmeric Transport", "phone": "9422500061", "district": "Sangli", "state": "Maharashtra", "vehicle_types": "Medium truck, Tempo 407", "rate_per_km_per_qtl": 0.40, "max_capacity_tonnes": 18},
    {"name": "Kolhapur Sugarcane Movers", "phone": "9422500062", "district": "Kolhapur", "state": "Maharashtra", "vehicle_types": "Tractor-trolley, Large truck", "rate_per_km_per_qtl": 0.34, "max_capacity_tonnes": 35},
    {"name": "Yavatmal Cotton Logistics", "phone": "7744400032", "district": "Yavatmal", "state": "Maharashtra", "vehicle_types": "Cotton trolley", "rate_per_km_per_qtl": 0.36, "max_capacity_tonnes": 20},
    {"name": "Wardha Farm Transport", "phone": "7744400033", "district": "Wardha", "state": "Maharashtra", "vehicle_types": "Tractor-trolley, Tempo 407", "rate_per_km_per_qtl": 0.37, "max_capacity_tonnes": 12},
    # Punjab / Haryana
    {"name": "Ludhiana Grain Carriers", "phone": "9815500001", "district": "Ludhiana", "state": "Punjab", "vehicle_types": "Large truck, Container", "rate_per_km_per_qtl": 0.32, "max_capacity_tonnes": 40},
    {"name": "Karnal Basmati Movers", "phone": "9812200001", "district": "Karnal", "state": "Haryana", "vehicle_types": "Large truck", "rate_per_km_per_qtl": 0.30, "max_capacity_tonnes": 35},
    # Uttar Pradesh
    {"name": "Agra Potato Transport", "phone": "9412200001", "district": "Agra", "state": "Uttar Pradesh", "vehicle_types": "Reefer truck, Medium truck", "rate_per_km_per_qtl": 0.38, "max_capacity_tonnes": 20},
    {"name": "Lucknow Agri Logistics", "phone": "9412200002", "district": "Lucknow", "state": "Uttar Pradesh", "vehicle_types": "Large truck, Container", "rate_per_km_per_qtl": 0.35, "max_capacity_tonnes": 30},
    # Madhya Pradesh
    {"name": "Indore Soybean Carriers", "phone": "9893300001", "district": "Indore", "state": "Madhya Pradesh", "vehicle_types": "Large truck, Medium truck", "rate_per_km_per_qtl": 0.36, "max_capacity_tonnes": 30},
    # Gujarat
    {"name": "Rajkot Groundnut Transport", "phone": "9824400001", "district": "Rajkot", "state": "Gujarat", "vehicle_types": "Medium truck, Tempo 407", "rate_per_km_per_qtl": 0.38, "max_capacity_tonnes": 20},
    # Karnataka
    {"name": "Kolar Tomato Reefer", "phone": "9945500001", "district": "Kolar", "state": "Karnataka", "vehicle_types": "Reefer truck, Tempo 407", "rate_per_km_per_qtl": 0.48, "max_capacity_tonnes": 10},
    # Andhra Pradesh
    {"name": "Guntur Chilli Carriers", "phone": "9848800001", "district": "Guntur", "state": "Andhra Pradesh", "vehicle_types": "Medium truck, Large truck", "rate_per_km_per_qtl": 0.40, "max_capacity_tonnes": 25},
    # West Bengal
    {"name": "Hooghly Potato Logistics", "phone": "9836600001", "district": "Hooghly", "state": "West Bengal", "vehicle_types": "Reefer truck, Medium truck", "rate_per_km_per_qtl": 0.42, "max_capacity_tonnes": 18},
]


def seed_transporters(db) -> int:
    """Insert seed transporters if the table is empty. Returns inserted count."""
    from sqlalchemy import select, func
    from app.models.transporter import Transporter

    count = db.execute(select(func.count()).select_from(Transporter)).scalar_one()
    if count > 0:
        return 0

    inserted = 0
    for entry in _SEED:
        lat = entry.get("lat")
        lon = entry.get("lon")
        if lat is None and entry.get("district") in DISTRICT_CENTROIDS:
            lat, lon = DISTRICT_CENTROIDS[entry["district"]]
        t = Transporter(
            name=entry["name"],
            phone=entry.get("phone"),
            district=entry.get("district"),
            state=entry.get("state"),
            lat=lat,
            lon=lon,
            vehicle_types=entry.get("vehicle_types"),
            rate_per_km_per_qtl=entry.get("rate_per_km_per_qtl"),
            max_capacity_tonnes=entry.get("max_capacity_tonnes"),
        )
        db.add(t)
        inserted += 1
    db.commit()
    return inserted


def nearby_transporters(
    db,
    lat: float | None,
    lon: float | None,
    district: str | None,
    state: str | None,
    max_km: float = 300.0,
    limit: int = 10,
) -> list[dict]:
    """Return active transporters sorted by distance from the given point."""
    from sqlalchemy import select
    from app.models.transporter import Transporter

    stmt = select(Transporter).where(Transporter.is_active.is_(True))
    if state:
        stmt = stmt.where(Transporter.state == state)
    rows = db.execute(stmt).scalars().all()

    origin: tuple[float, float] | None = None
    if lat is not None and lon is not None:
        origin = (lat, lon)
    elif district and district in DISTRICT_CENTROIDS:
        origin = DISTRICT_CENTROIDS[district]

    result = []
    for t in rows:
        dist_km: float | None = None
        if origin and t.lat is not None and t.lon is not None:
            dist_km = round(haversine_km(origin, (t.lat, t.lon)), 1)
            if dist_km > max_km:
                continue
        result.append({
            "id": t.id,
            "name": t.name,
            "phone": t.phone,
            "district": t.district,
            "state": t.state,
            "vehicle_types": t.vehicle_types,
            "rate_per_km_per_qtl": t.rate_per_km_per_qtl,
            "max_capacity_tonnes": t.max_capacity_tonnes,
            "distance_km": dist_km,
        })

    result.sort(key=lambda x: (x["distance_km"] is None, x["distance_km"] or 0))
    return result[:limit]
