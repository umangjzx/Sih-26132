"""Curated agricultural reference data for Maharashtra.

Four datasets that a farmer's sell/hold decision needs but which are not in the
AGMARKNET price feed:

  * MSP        — Minimum Support Price by commodity (Govt. of India, 2024-25 /
                 rabi 2025-26 seasons, ₹ per quintal). Perishables (onion,
                 tomato, most vegetables) have NO MSP — we say so explicitly.
  * CALENDAR   — Maharashtra sowing / harvest / peak-arrival windows per crop.
  * COLD_STORAGE — representative WDRA-style cold storage & warehouse facilities
                 with district + coordinates + capacity.
  * FPOS       — representative Farmer Producer Organisations with district,
                 focus crops and size.

The cold-storage and FPO lists are a curated demo sample (the equivalent
data.gov.in resources are not reliably API-accessible); everything is real
Maharashtra geography and plausible scale.
"""

from datetime import date

from app.services.geo import DISTRICT_CENTROIDS, haversine_km

# --------------------------------------------------------------------------- #
# MSP — ₹ per quintal. None-valued crops are market-driven (no MSP).
# --------------------------------------------------------------------------- #

MSP: dict[str, dict] = {
    "Paddy": {"price": 2300, "season": "Kharif 2024-25", "unit": "₹/quintal"},
    "Rice": {"price": 2300, "season": "Kharif 2024-25", "unit": "₹/quintal"},
    "Jowar": {"price": 3371, "season": "Kharif 2024-25", "unit": "₹/quintal"},
    "Sorghum": {"price": 3371, "season": "Kharif 2024-25", "unit": "₹/quintal"},
    "Bajra": {"price": 2625, "season": "Kharif 2024-25", "unit": "₹/quintal"},
    "Maize": {"price": 2225, "season": "Kharif 2024-25", "unit": "₹/quintal"},
    "Tur": {"price": 7550, "season": "Kharif 2024-25", "unit": "₹/quintal"},
    "Arhar": {"price": 7550, "season": "Kharif 2024-25", "unit": "₹/quintal"},
    "Moong": {"price": 8682, "season": "Kharif 2024-25", "unit": "₹/quintal"},
    "Green Gram": {"price": 8682, "season": "Kharif 2024-25", "unit": "₹/quintal"},
    "Urad": {"price": 7400, "season": "Kharif 2024-25", "unit": "₹/quintal"},
    "Black Gram": {"price": 7400, "season": "Kharif 2024-25", "unit": "₹/quintal"},
    "Groundnut": {"price": 6783, "season": "Kharif 2024-25", "unit": "₹/quintal"},
    "Soybean": {"price": 4892, "season": "Kharif 2024-25", "unit": "₹/quintal"},
    "Sunflower": {"price": 7280, "season": "Kharif 2024-25", "unit": "₹/quintal"},
    "Sesamum": {"price": 9267, "season": "Kharif 2024-25", "unit": "₹/quintal"},
    "Cotton": {"price": 7121, "season": "Kharif 2024-25 (medium staple)", "unit": "₹/quintal"},
    "Wheat": {"price": 2425, "season": "Rabi 2025-26", "unit": "₹/quintal"},
    "Barley": {"price": 1980, "season": "Rabi 2025-26", "unit": "₹/quintal"},
    "Gram": {"price": 5650, "season": "Rabi 2025-26", "unit": "₹/quintal"},
    "Chana": {"price": 5650, "season": "Rabi 2025-26", "unit": "₹/quintal"},
    "Masur": {"price": 6700, "season": "Rabi 2025-26", "unit": "₹/quintal"},
    "Lentil": {"price": 6700, "season": "Rabi 2025-26", "unit": "₹/quintal"},
    "Mustard": {"price": 5950, "season": "Rabi 2025-26", "unit": "₹/quintal"},
    "Safflower": {"price": 5940, "season": "Rabi 2025-26", "unit": "₹/quintal"},
    # explicit no-MSP crops
    "Onion": None,
    "Tomato": None,
    "Potato": None,
    "Cabbage": None,
    "Cauliflower": None,
    "Brinjal": None,
    "Okra": None,
    "Green Chilli": None,
    "Banana": None,
    "Grapes": None,
    "Pomegranate": None,
}


def msp_for(crop: str) -> dict | None:
    """{'price', 'season', 'unit'} or None (no MSP / unknown)."""
    entry = MSP.get(crop.strip()) or MSP.get(crop.strip().title())
    return entry


# --------------------------------------------------------------------------- #
# Crop calendar — month numbers (1-12).
# --------------------------------------------------------------------------- #

CALENDAR: dict[str, dict] = {
    "Onion": {"sow": [6, 7, 11, 12], "harvest": [10, 11, 12, 3, 4], "peak_arrival": [11, 12, 1, 2],
              "note": "Rabi onion (Nov-Dec sown, Mar-May harvest) is the storage crop; kharif is sold fresh."},
    "Tur": {"sow": [6, 7], "harvest": [11, 12, 1], "peak_arrival": [12, 1, 2],
            "note": "Single kharif season; arrivals concentrate Dec-Feb."},
    "Cotton": {"sow": [6, 7], "harvest": [10, 11, 12, 1], "peak_arrival": [11, 12, 1, 2],
               "note": "Picking runs Oct-Jan; ginning-season arrivals peak Nov-Feb."},
    "Soybean": {"sow": [6, 7], "harvest": [9, 10], "peak_arrival": [10, 11],
                "note": "Short kharif crop; the market floods Oct-Nov right after harvest."},
    "Tomato": {"sow": [6, 7, 10, 11, 1, 2], "harvest": [9, 10, 11, 1, 2, 3, 4, 5, 6],
               "peak_arrival": [12, 1, 2], "note": "Grown in staggered batches year-round; prices swing hard."},
    "Wheat": {"sow": [11, 12], "harvest": [2, 3], "peak_arrival": [3, 4],
              "note": "Rabi crop; arrivals peak at harvest in Mar-Apr."},
    "Maize": {"sow": [6, 7, 10, 11], "harvest": [9, 10, 2, 3], "peak_arrival": [10, 11, 3],
              "note": "Both kharif and rabi maize are grown in Maharashtra."},
    "Gram": {"sow": [10, 11], "harvest": [2, 3], "peak_arrival": [3, 4],
             "note": "Rabi pulse; arrivals peak Mar-Apr."},
    "Bajra": {"sow": [6, 7], "harvest": [9, 10], "peak_arrival": [10, 11], "note": "Rain-fed kharif millet."},
    "Jowar": {"sow": [6, 7, 9, 10], "harvest": [10, 11, 1, 2], "peak_arrival": [11, 1, 2],
              "note": "Rabi jowar (Sep-Oct sown) is the main Maharashtra crop."},
    "Groundnut": {"sow": [6, 7, 1, 2], "harvest": [10, 11, 5, 6], "peak_arrival": [11, 6],
                  "note": "Kharif and summer crops both grown."},
    "Sugarcane": {"sow": [10, 11, 12, 1, 2, 3], "harvest": [10, 11, 12, 1, 2, 3],
                  "peak_arrival": [12, 1, 2], "note": "Crushing season Oct-Mar; paid on FRP, not MSP."},
}

_MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _months_label(months: list[int]) -> str:
    return ", ".join(_MONTHS[m] for m in months)


def calendar_for(crop: str, today: date | None = None) -> dict | None:
    entry = CALENDAR.get(crop.strip()) or CALENDAR.get(crop.strip().title())
    if not entry:
        return None
    today = today or date.today()
    m = today.month
    phase = "off-season"
    if m in entry["harvest"] and m in entry["peak_arrival"]:
        phase = "peak harvest & arrivals"
    elif m in entry["harvest"]:
        phase = "harvest window"
    elif m in entry["peak_arrival"]:
        phase = "peak arrivals"
    elif m in entry["sow"]:
        phase = "sowing window"
    glut_risk = m in entry["peak_arrival"]
    return {
        "crop": crop,
        "sow_months": _months_label(entry["sow"]),
        "harvest_months": _months_label(entry["harvest"]),
        "peak_arrival_months": _months_label(entry["peak_arrival"]),
        "current_phase": phase,
        "glut_risk": glut_risk,
        "note": entry["note"],
    }


# --------------------------------------------------------------------------- #
# Cold storage / warehouses (curated demo sample; real geography).
# --------------------------------------------------------------------------- #

COLD_STORAGE: list[dict] = [
    {"name": "Lasalgaon Onion Cold Store", "type": "cold_storage", "district": "Nashik", "lat": 20.1427, "lon": 74.2395, "capacity_tonnes": 5000, "crops": "Onion, Potato"},
    {"name": "Pimpalgaon Agri Warehouse", "type": "warehouse", "district": "Nashik", "lat": 20.1739, "lon": 73.9880, "capacity_tonnes": 8000, "crops": "Grain, Pulses"},
    {"name": "Nashik MSWC Godown", "type": "warehouse", "district": "Nashik", "lat": 19.9975, "lon": 73.7898, "capacity_tonnes": 12000, "crops": "Grain, Oilseed"},
    {"name": "Pune Market Yard Cold Store", "type": "cold_storage", "district": "Pune", "lat": 18.4820, "lon": 73.8790, "capacity_tonnes": 4000, "crops": "Vegetables, Fruit"},
    {"name": "Baramati FPC Warehouse", "type": "warehouse", "district": "Pune", "lat": 18.1514, "lon": 74.5772, "capacity_tonnes": 6000, "crops": "Grain, Onion"},
    {"name": "Ahmednagar MSWC Warehouse", "type": "warehouse", "district": "Ahmednagar", "lat": 19.0948, "lon": 74.7480, "capacity_tonnes": 10000, "crops": "Grain, Pulses"},
    {"name": "Rahuri Cold Storage", "type": "cold_storage", "district": "Ahmednagar", "lat": 19.3900, "lon": 74.6500, "capacity_tonnes": 3500, "crops": "Onion, Pomegranate"},
    {"name": "Solapur Central Warehouse", "type": "warehouse", "district": "Solapur", "lat": 17.6599, "lon": 75.9064, "capacity_tonnes": 15000, "crops": "Tur, Jowar, Grain"},
    {"name": "Barshi Agri Godown", "type": "warehouse", "district": "Solapur", "lat": 18.2340, "lon": 75.6910, "capacity_tonnes": 7000, "crops": "Pulses, Oilseed"},
    {"name": "Sangli Turmeric & Cold Store", "type": "cold_storage", "district": "Sangli", "lat": 16.8524, "lon": 74.5815, "capacity_tonnes": 4500, "crops": "Turmeric, Grapes, Raisins"},
    {"name": "Kolhapur Jaggery Warehouse", "type": "warehouse", "district": "Kolhapur", "lat": 16.7050, "lon": 74.2433, "capacity_tonnes": 9000, "crops": "Sugarcane products, Grain"},
    {"name": "Satara MSWC Godown", "type": "warehouse", "district": "Satara", "lat": 17.6805, "lon": 74.0183, "capacity_tonnes": 8000, "crops": "Grain, Soybean"},
    {"name": "Jalgaon Banana Cold Chain", "type": "cold_storage", "district": "Jalgaon", "lat": 21.0077, "lon": 75.5626, "capacity_tonnes": 6000, "crops": "Banana, Cotton bales"},
    {"name": "Dhule Oilseed Warehouse", "type": "warehouse", "district": "Dhule", "lat": 20.9042, "lon": 74.7749, "capacity_tonnes": 7500, "crops": "Groundnut, Cotton"},
    {"name": "Chhatrapati Sambhajinagar CWC", "type": "warehouse", "district": "Chhatrapati Sambhajinagar", "lat": 19.8762, "lon": 75.3433, "capacity_tonnes": 14000, "crops": "Grain, Cotton"},
    {"name": "Jalna Cold Storage Hub", "type": "cold_storage", "district": "Jalna", "lat": 19.8410, "lon": 75.8864, "capacity_tonnes": 5000, "crops": "Sweet lime, Vegetables"},
    {"name": "Latur Pulses Warehouse", "type": "warehouse", "district": "Latur", "lat": 18.4088, "lon": 76.5604, "capacity_tonnes": 16000, "crops": "Tur, Soybean, Gram"},
    {"name": "Nanded Grain Godown", "type": "warehouse", "district": "Nanded", "lat": 19.1383, "lon": 77.3210, "capacity_tonnes": 9000, "crops": "Grain, Turmeric"},
    {"name": "Akola Cotton & Grain Warehouse", "type": "warehouse", "district": "Akola", "lat": 20.7002, "lon": 77.0082, "capacity_tonnes": 12000, "crops": "Cotton, Tur, Soybean"},
    {"name": "Amravati Orange Cold Store", "type": "cold_storage", "district": "Amravati", "lat": 20.9374, "lon": 77.7796, "capacity_tonnes": 5500, "crops": "Orange, Vegetables"},
    {"name": "Yavatmal Cotton Warehouse", "type": "warehouse", "district": "Yavatmal", "lat": 20.3888, "lon": 78.1204, "capacity_tonnes": 10000, "crops": "Cotton, Soybean"},
    {"name": "Nagpur CWC Central Warehouse", "type": "warehouse", "district": "Nagpur", "lat": 21.1458, "lon": 79.0882, "capacity_tonnes": 20000, "crops": "Grain, Orange, Pulses"},
    {"name": "Wardha Agri Godown", "type": "warehouse", "district": "Wardha", "lat": 20.7453, "lon": 78.6022, "capacity_tonnes": 6000, "crops": "Cotton, Soybean"},
    {"name": "Chandrapur Rice Warehouse", "type": "warehouse", "district": "Chandrapur", "lat": 19.9615, "lon": 79.2961, "capacity_tonnes": 8000, "crops": "Paddy, Grain"},
    {"name": "Beed Cold Storage", "type": "cold_storage", "district": "Beed", "lat": 18.9891, "lon": 75.7601, "capacity_tonnes": 3000, "crops": "Onion, Vegetables"},
    {"name": "Nandurbar Chilli Cold Store", "type": "cold_storage", "district": "Nandurbar", "lat": 21.3667, "lon": 74.2400, "capacity_tonnes": 4000, "crops": "Chilli, Papaya"},
    {"name": "Buldhana Grain Warehouse", "type": "warehouse", "district": "Buldhana", "lat": 20.5293, "lon": 76.1802, "capacity_tonnes": 7000, "crops": "Soybean, Tur"},
    {"name": "Raigad Coastal Cold Chain", "type": "cold_storage", "district": "Raigad", "lat": 18.5158, "lon": 73.1822, "capacity_tonnes": 3500, "crops": "Fish, Vegetables, Fruit"},
]


# --------------------------------------------------------------------------- #
# Farmer Producer Organisations (curated demo sample).
# --------------------------------------------------------------------------- #

FPOS: list[dict] = [
    {"name": "Sahyadri Farms Producer Co.", "district": "Nashik", "crops": "Grapes, Tomato, Onion", "members": 18000, "contact": "connect@example-fpo.in"},
    {"name": "Lasalgaon Onion Growers FPC", "district": "Nashik", "crops": "Onion", "members": 2400, "contact": "onion-fpc@example-fpo.in"},
    {"name": "Baramati Agro Producer Co.", "district": "Pune", "crops": "Grain, Onion, Sugarcane", "members": 3100, "contact": "baramati@example-fpo.in"},
    {"name": "Junnar Vegetable FPC", "district": "Pune", "crops": "Tomato, Leafy greens", "members": 1600, "contact": "junnar-veg@example-fpo.in"},
    {"name": "Ahmednagar Pulses FPC", "district": "Ahmednagar", "crops": "Tur, Gram, Soybean", "members": 2800, "contact": "anagar-pulses@example-fpo.in"},
    {"name": "Sangamner Dairy & Crop FPC", "district": "Ahmednagar", "crops": "Onion, Fodder, Milk", "members": 4200, "contact": "sangamner@example-fpo.in"},
    {"name": "Solapur Tur Growers FPC", "district": "Solapur", "crops": "Tur, Jowar", "members": 3600, "contact": "solapur-tur@example-fpo.in"},
    {"name": "Pandharpur Grape FPC", "district": "Solapur", "crops": "Grapes, Pomegranate", "members": 900, "contact": "pandharpur@example-fpo.in"},
    {"name": "Sangli Turmeric Producer Co.", "district": "Sangli", "crops": "Turmeric, Sugarcane", "members": 2100, "contact": "sangli-turmeric@example-fpo.in"},
    {"name": "Kolhapur Cane Growers FPC", "district": "Kolhapur", "crops": "Sugarcane, Jaggery", "members": 5200, "contact": "kolhapur-cane@example-fpo.in"},
    {"name": "Satara Soybean FPC", "district": "Satara", "crops": "Soybean, Grain", "members": 1900, "contact": "satara-soy@example-fpo.in"},
    {"name": "Jalgaon Banana Producer Co.", "district": "Jalgaon", "crops": "Banana, Cotton", "members": 4600, "contact": "jalgaon-banana@example-fpo.in"},
    {"name": "Khandesh Cotton FPC", "district": "Dhule", "crops": "Cotton, Groundnut", "members": 2700, "contact": "khandesh-cotton@example-fpo.in"},
    {"name": "Marathwada Grain Producer Co.", "district": "Chhatrapati Sambhajinagar", "crops": "Cotton, Maize, Grain", "members": 3400, "contact": "marathwada-grain@example-fpo.in"},
    {"name": "Jalna Sweet Lime FPC", "district": "Jalna", "crops": "Sweet lime, Cotton", "members": 1500, "contact": "jalna-mosambi@example-fpo.in"},
    {"name": "Latur Soybean & Tur FPC", "district": "Latur", "crops": "Soybean, Tur, Gram", "members": 6100, "contact": "latur-soy@example-fpo.in"},
    {"name": "Nanded Turmeric Producer Co.", "district": "Nanded", "crops": "Turmeric, Paddy", "members": 2000, "contact": "nanded-turmeric@example-fpo.in"},
    {"name": "Vidarbha Organic Cotton FPC", "district": "Yavatmal", "crops": "Cotton, Soybean, Pulses", "members": 3800, "contact": "vidarbha-cotton@example-fpo.in"},
    {"name": "Akola Farmers Producer Co.", "district": "Akola", "crops": "Tur, Soybean, Cotton", "members": 2900, "contact": "akola-fpc@example-fpo.in"},
    {"name": "Amravati Orange Growers FPC", "district": "Amravati", "crops": "Orange, Vegetables", "members": 3300, "contact": "amravati-orange@example-fpo.in"},
    {"name": "Nagpur Citrus Producer Co.", "district": "Nagpur", "crops": "Orange, Grain", "members": 4100, "contact": "nagpur-citrus@example-fpo.in"},
    {"name": "Wardha Cotton FPC", "district": "Wardha", "crops": "Cotton, Soybean", "members": 1700, "contact": "wardha-cotton@example-fpo.in"},
    {"name": "Bhandara Paddy Producer Co.", "district": "Bhandara", "crops": "Paddy, Fish", "members": 2500, "contact": "bhandara-paddy@example-fpo.in"},
    {"name": "Nandurbar Tribal Farmers FPC", "district": "Nandurbar", "crops": "Chilli, Papaya, Maize", "members": 2200, "contact": "nandurbar-fpc@example-fpo.in"},
]


# --------------------------------------------------------------------------- #
# Distance-filtered accessors
# --------------------------------------------------------------------------- #

def _origin_coords(district: str | None, lat: float | None, lon: float | None) -> tuple[float, float] | None:
    if lat is not None and lon is not None:
        return (lat, lon)
    if district and district in DISTRICT_CENTROIDS:
        return DISTRICT_CENTROIDS[district]
    return None


def nearby_cold_storage(
    district: str | None = None, lat: float | None = None, lon: float | None = None,
    max_km: float = 150.0, limit: int = 8,
) -> list[dict]:
    origin = _origin_coords(district, lat, lon)
    out = []
    for f in COLD_STORAGE:
        d = round(haversine_km(origin, (f["lat"], f["lon"])), 1) if origin else None
        if d is not None and d > max_km:
            continue
        out.append({**f, "distance_km": d})
    out.sort(key=lambda x: (x["distance_km"] is None, x["distance_km"] or 0.0))
    return out[:limit]


def nearby_fpos(
    district: str | None = None, crop: str | None = None, limit: int = 8,
) -> list[dict]:
    origin = DISTRICT_CENTROIDS.get(district) if district else None
    out = []
    for f in FPOS:
        if crop and crop.strip().lower() not in f["crops"].lower():
            continue
        fo = DISTRICT_CENTROIDS.get(f["district"])
        d = round(haversine_km(origin, fo), 1) if (origin and fo) else None
        out.append({**f, "distance_km": d})
    out.sort(key=lambda x: (x["distance_km"] is None, x["distance_km"] or 0.0))
    return out[:limit]
