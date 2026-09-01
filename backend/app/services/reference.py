"""Curated agricultural reference data for Maharashtra.

Four datasets that a farmer's sell/hold decision needs but which are not in the
AGMARKNET price feed:

  * MSP        — Minimum Support Price by commodity (Govt. of India, 2024-25 /
                 rabi 2025-26 seasons, ₹ per quintal). Perishables (onion,
                 tomato, most vegetables) have NO MSP — we say so explicitly.
  * CALENDAR   — Maharashtra sowing / harvest / peak-arrival windows per crop.
  * COLD_STORAGE — representative WDRA-style cold storage & warehouse facilities
                 with state + district + coordinates + capacity.
  * FPOS       — representative Farmer Producer Organisations with state,
                 district, coordinates, focus crops and size.

The cold-storage and FPO lists are a curated sample (the equivalent data.gov.in
resources are not reliably API-accessible): a detailed Maharashtra set plus a
national sample covering the major producing states, all real district geography
and plausible scale. MSP is all-India; the crop calendar stays Maharashtra-tuned.
"""

from datetime import date

from app.services.geo import DISTRICT_CENTROIDS, STATE_CENTROIDS, haversine_km

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


# All-India sample (v1.2) — representative registered warehouses / cold stores in
# the major producing states, real district geography and plausible scale. Same
# "curated sample, not a live API" caveat as the Maharashtra list.
_INDIA_COLD_STORAGE: list[dict] = [
    {"name": "Jalandhar Potato Cold Store", "type": "cold_storage", "state": "Punjab", "district": "Jalandhar", "lat": 31.3260, "lon": 75.5762, "capacity_tonnes": 12000, "crops": "Potato, Peas"},
    {"name": "Ludhiana CWC Warehouse", "type": "warehouse", "state": "Punjab", "district": "Ludhiana", "lat": 30.9010, "lon": 75.8573, "capacity_tonnes": 18000, "crops": "Wheat, Paddy, Maize"},
    {"name": "Karnal Grain Warehouse", "type": "warehouse", "state": "Haryana", "district": "Karnal", "lat": 29.6857, "lon": 76.9905, "capacity_tonnes": 15000, "crops": "Wheat, Basmati, Paddy"},
    {"name": "Sonipat Cold Chain", "type": "cold_storage", "state": "Haryana", "district": "Sonipat", "lat": 28.9931, "lon": 77.0151, "capacity_tonnes": 8000, "crops": "Vegetables, Mushroom"},
    {"name": "Agra Potato Cold Store", "type": "cold_storage", "state": "Uttar Pradesh", "district": "Agra", "lat": 27.1767, "lon": 78.0081, "capacity_tonnes": 20000, "crops": "Potato"},
    {"name": "Lucknow FCI Godown", "type": "warehouse", "state": "Uttar Pradesh", "district": "Lucknow", "lat": 26.8467, "lon": 80.9462, "capacity_tonnes": 22000, "crops": "Wheat, Paddy, Pulses"},
    {"name": "Varanasi Vegetable Cold Store", "type": "cold_storage", "state": "Uttar Pradesh", "district": "Varanasi", "lat": 25.3176, "lon": 82.9739, "capacity_tonnes": 6000, "crops": "Vegetables, Green peas"},
    {"name": "Indore Soybean Warehouse", "type": "warehouse", "state": "Madhya Pradesh", "district": "Indore", "lat": 22.7196, "lon": 75.8577, "capacity_tonnes": 25000, "crops": "Soybean, Wheat, Gram"},
    {"name": "Bhopal Central Warehouse", "type": "warehouse", "state": "Madhya Pradesh", "district": "Bhopal", "lat": 23.2599, "lon": 77.4126, "capacity_tonnes": 16000, "crops": "Wheat, Pulses, Oilseed"},
    {"name": "Rajkot Groundnut Warehouse", "type": "warehouse", "state": "Gujarat", "district": "Rajkot", "lat": 22.3039, "lon": 70.8022, "capacity_tonnes": 14000, "crops": "Groundnut, Cotton, Cumin"},
    {"name": "Deesa Potato Cold Store", "type": "cold_storage", "state": "Gujarat", "district": "Banaskantha", "lat": 24.2585, "lon": 72.1907, "capacity_tonnes": 18000, "crops": "Potato"},
    {"name": "Kota Coriander Warehouse", "type": "warehouse", "state": "Rajasthan", "district": "Kota", "lat": 25.2138, "lon": 75.8648, "capacity_tonnes": 12000, "crops": "Coriander, Soybean, Wheat"},
    {"name": "Jaipur Agro Cold Store", "type": "cold_storage", "state": "Rajasthan", "district": "Jaipur", "lat": 26.9124, "lon": 75.7873, "capacity_tonnes": 9000, "crops": "Vegetables, Mustard, Guar"},
    {"name": "Kolar Tomato Cold Store", "type": "cold_storage", "state": "Karnataka", "district": "Kolar", "lat": 13.1367, "lon": 78.1292, "capacity_tonnes": 7000, "crops": "Tomato, Mango"},
    {"name": "Hubballi APMC Warehouse", "type": "warehouse", "state": "Karnataka", "district": "Dharwad", "lat": 15.3647, "lon": 75.1240, "capacity_tonnes": 13000, "crops": "Cotton, Chilli, Groundnut"},
    {"name": "Guntur Chilli Cold Store", "type": "cold_storage", "state": "Andhra Pradesh", "district": "Guntur", "lat": 16.3067, "lon": 80.4365, "capacity_tonnes": 30000, "crops": "Chilli, Cotton, Turmeric"},
    {"name": "Warangal Paddy Warehouse", "type": "warehouse", "state": "Telangana", "district": "Warangal", "lat": 17.9689, "lon": 79.5941, "capacity_tonnes": 20000, "crops": "Paddy, Maize, Cotton"},
    {"name": "Erode Turmeric Warehouse", "type": "warehouse", "state": "Tamil Nadu", "district": "Erode", "lat": 11.3410, "lon": 77.7172, "capacity_tonnes": 10000, "crops": "Turmeric, Banana"},
    {"name": "Hooghly Potato Cold Store", "type": "cold_storage", "state": "West Bengal", "district": "Hooghly", "lat": 22.9089, "lon": 88.3960, "capacity_tonnes": 22000, "crops": "Potato, Vegetables"},
    {"name": "Samastipur Maize Warehouse", "type": "warehouse", "state": "Bihar", "district": "Samastipur", "lat": 25.8560, "lon": 85.7799, "capacity_tonnes": 11000, "crops": "Maize, Wheat, Litchi"},
    {"name": "Cuttack Rice Warehouse", "type": "warehouse", "state": "Odisha", "district": "Cuttack", "lat": 20.4625, "lon": 85.8828, "capacity_tonnes": 12000, "crops": "Paddy, Pulses"},
]

# Every Maharashtra entry gets an explicit state tag, then the national sample.
COLD_STORAGE = [{**e, "state": e.get("state", "Maharashtra")} for e in COLD_STORAGE] + _INDIA_COLD_STORAGE


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

# All-India sample (v1.2) — representative FPOs in the major producing states.
_INDIA_FPOS: list[dict] = [
    {"name": "Malwa Kisan Producer Co.", "state": "Punjab", "district": "Ludhiana", "lat": 30.9010, "lon": 75.8573, "crops": "Wheat, Paddy, Maize", "members": 3200, "contact": "malwa-fpc@example-fpo.in"},
    {"name": "Doaba Potato Growers FPC", "state": "Punjab", "district": "Jalandhar", "lat": 31.3260, "lon": 75.5762, "crops": "Potato, Peas", "members": 1800, "contact": "doaba-potato@example-fpo.in"},
    {"name": "Karnal Basmati Producer Co.", "state": "Haryana", "district": "Karnal", "lat": 29.6857, "lon": 76.9905, "crops": "Basmati, Wheat", "members": 2600, "contact": "karnal-basmati@example-fpo.in"},
    {"name": "Awadh Farmers Producer Co.", "state": "Uttar Pradesh", "district": "Lucknow", "lat": 26.8467, "lon": 80.9462, "crops": "Wheat, Paddy, Pulses", "members": 4100, "contact": "awadh-fpc@example-fpo.in"},
    {"name": "Braj Potato Growers FPC", "state": "Uttar Pradesh", "district": "Agra", "lat": 27.1767, "lon": 78.0081, "crops": "Potato", "members": 2300, "contact": "braj-potato@example-fpo.in"},
    {"name": "Malwa Soybean Producer Co.", "state": "Madhya Pradesh", "district": "Indore", "lat": 22.7196, "lon": 75.8577, "crops": "Soybean, Wheat, Gram", "members": 5200, "contact": "malwa-soy@example-fpo.in"},
    {"name": "Narmada Valley Farmers FPC", "state": "Madhya Pradesh", "district": "Narmadapuram", "lat": 22.7500, "lon": 77.7300, "crops": "Wheat, Tur, Cotton", "members": 2900, "contact": "narmada-fpc@example-fpo.in"},
    {"name": "Saurashtra Groundnut FPC", "state": "Gujarat", "district": "Rajkot", "lat": 22.3039, "lon": 70.8022, "crops": "Groundnut, Cotton", "members": 3400, "contact": "saurashtra-gn@example-fpo.in"},
    {"name": "Banas Potato Producer Co.", "state": "Gujarat", "district": "Banaskantha", "lat": 24.1700, "lon": 72.4300, "crops": "Potato, Fennel", "members": 2100, "contact": "banas-potato@example-fpo.in"},
    {"name": "Hadoti Spice Growers FPC", "state": "Rajasthan", "district": "Kota", "lat": 25.2138, "lon": 75.8648, "crops": "Coriander, Soybean", "members": 1900, "contact": "hadoti-spice@example-fpo.in"},
    {"name": "Kolar Horticulture FPC", "state": "Karnataka", "district": "Kolar", "lat": 13.1367, "lon": 78.1292, "crops": "Tomato, Mango", "members": 1600, "contact": "kolar-hort@example-fpo.in"},
    {"name": "North Karnataka Cotton FPC", "state": "Karnataka", "district": "Dharwad", "lat": 15.3647, "lon": 75.1240, "crops": "Cotton, Chilli, Groundnut", "members": 2800, "contact": "nk-cotton@example-fpo.in"},
    {"name": "Guntur Chilli Producer Co.", "state": "Andhra Pradesh", "district": "Guntur", "lat": 16.3067, "lon": 80.4365, "crops": "Chilli, Cotton, Turmeric", "members": 4300, "contact": "guntur-chilli@example-fpo.in"},
    {"name": "Telangana Paddy Farmers FPC", "state": "Telangana", "district": "Warangal", "lat": 17.9689, "lon": 79.5941, "crops": "Paddy, Maize, Cotton", "members": 3700, "contact": "ts-paddy@example-fpo.in"},
    {"name": "Kongu Turmeric Producer Co.", "state": "Tamil Nadu", "district": "Erode", "lat": 11.3410, "lon": 77.7172, "crops": "Turmeric, Banana", "members": 2200, "contact": "kongu-turmeric@example-fpo.in"},
    {"name": "Bengal Potato Growers FPC", "state": "West Bengal", "district": "Hooghly", "lat": 22.9089, "lon": 88.3960, "crops": "Potato, Vegetables", "members": 3100, "contact": "bengal-potato@example-fpo.in"},
    {"name": "Kosi Maize Producer Co.", "state": "Bihar", "district": "Samastipur", "lat": 25.8560, "lon": 85.7799, "crops": "Maize, Wheat, Litchi", "members": 2400, "contact": "kosi-maize@example-fpo.in"},
    {"name": "Mahanadi Paddy FPC", "state": "Odisha", "district": "Cuttack", "lat": 20.4625, "lon": 85.8828, "crops": "Paddy, Pulses, Vegetables", "members": 2000, "contact": "mahanadi-fpc@example-fpo.in"},
]


def _fpo_with_meta(e: dict) -> dict:
    """Tag state (default Maharashtra) and backfill lat/lon from the MH district
    centroid table when the entry doesn't carry explicit coordinates."""
    out = {**e, "state": e.get("state", "Maharashtra")}
    if out.get("lat") is None and e["district"] in DISTRICT_CENTROIDS:
        out["lat"], out["lon"] = DISTRICT_CENTROIDS[e["district"]]
    return out


FPOS = [_fpo_with_meta(e) for e in FPOS] + _INDIA_FPOS


# --------------------------------------------------------------------------- #
# Distance-filtered accessors
# --------------------------------------------------------------------------- #

def _state_centroid(state: str | None) -> tuple[float, float] | None:
    if not state:
        return None
    s = state.strip().lower()
    for k, v in STATE_CENTROIDS.items():
        if k.lower() == s:
            return v
    return None


def _origin_coords(
    district: str | None, lat: float | None, lon: float | None, state: str | None = None
) -> tuple[float, float] | None:
    if lat is not None and lon is not None:
        return (lat, lon)
    if district and district in DISTRICT_CENTROIDS:
        return DISTRICT_CENTROIDS[district]
    return _state_centroid(state)


def _scoped(rows: list[dict], state: str | None) -> tuple[list[dict], bool]:
    """Filter to a state when asked. Returns (rows, precise) where precise is
    False once we've fallen back to a whole-state view (used to relax the
    distance cap so a state-centroid origin doesn't hide everything)."""
    if not state:
        return rows, True
    s = state.strip().lower()
    return [r for r in rows if r.get("state", "").lower() == s], False


def nearby_cold_storage(
    district: str | None = None, lat: float | None = None, lon: float | None = None,
    max_km: float = 150.0, limit: int = 8, state: str | None = None,
) -> list[dict]:
    pool, precise = _scoped(COLD_STORAGE, state)
    origin = _origin_coords(district, lat, lon, state)
    has_point = (lat is not None and lon is not None) or (district in DISTRICT_CENTROIDS)
    cap = max_km if (precise or has_point) else 10_000.0
    out = []
    for f in pool:
        d = round(haversine_km(origin, (f["lat"], f["lon"])), 1) if origin else None
        if d is not None and d > cap:
            continue
        out.append({**f, "distance_km": d})
    out.sort(key=lambda x: (x["distance_km"] is None, x["distance_km"] or 0.0))
    return out[:limit]


def nearby_fpos(
    district: str | None = None, crop: str | None = None, limit: int = 8,
    state: str | None = None, lat: float | None = None, lon: float | None = None,
) -> list[dict]:
    pool, _ = _scoped(FPOS, state)
    origin = _origin_coords(district, lat, lon, state)
    out = []
    for f in pool:
        if crop and crop.strip().lower() not in f["crops"].lower():
            continue
        fo = (f["lat"], f["lon"]) if f.get("lat") is not None else DISTRICT_CENTROIDS.get(f["district"])
        d = round(haversine_km(origin, fo), 1) if (origin and fo) else None
        out.append({**f, "distance_km": d})
    out.sort(key=lambda x: (x["distance_km"] is None, x["distance_km"] or 0.0))
    return out[:limit]
