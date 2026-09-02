"""Fallback seed data for local dev/demo when DATA_GOV_IN_API_KEY is not set
or the live data.gov.in call fails — keeps the app usable offline, per the
Section 4.2 fallback plan. Prices are synthetic but plausible, built as a
random walk with a mild trend and weekly arrival-volume cycle so trend charts
and the sell/wait signal have something meaningful to show.
"""

import random
from datetime import date, timedelta

MARKETS: list[tuple[str, str]] = [
    ("Pune", "Pune"),
    ("Lasalgaon", "Nashik"),
    ("Ahmednagar", "Ahmednagar"),
    ("Solapur", "Solapur"),
    ("Nagpur", "Nagpur"),
]

CROPS: list[tuple[str, str, tuple[float, float]]] = [
    ("Onion", "Local", (1200, 2400)),
    ("Tur", "FAQ", (7000, 9500)),
    ("Cotton", "Medium Staple", (6500, 8200)),
    ("Soybean", "Yellow", (4200, 5100)),
    ("Tomato", "Local", (800, 2200)),
]


def _series(
    rng: random.Random, market: str, district: str, state: str,
    crops: list[tuple[str, str, tuple[float, float]]], days: int,
) -> list[dict]:
    rows: list[dict] = []
    today = date.today()
    for crop, variety, (low, high) in crops:
        price = rng.uniform(low, high)
        for offset in range(days, -1, -1):
            day = today - timedelta(days=offset)
            drift = rng.uniform(-0.015, 0.018)
            price = max(low * 0.6, min(high * 1.4, price * (1 + drift)))
            spread = price * rng.uniform(0.04, 0.09)
            arrival_volume = round(
                max(5.0, rng.gauss(120, 35) * (1.4 if day.weekday() in (0, 3) else 1.0)), 1
            )
            rows.append({
                "crop": crop, "variety": variety, "market": market,
                "district": district, "state": state, "date": day,
                "min_price": round(price - spread / 2, 2),
                "max_price": round(price + spread / 2, 2),
                "modal_price": round(price, 2),
                "arrival_volume": arrival_volume,
            })
    return rows


def generate_fixture_rows(days: int = 90, seed: int = 26132) -> list[dict]:
    rng = random.Random(seed)
    rows: list[dict] = []
    for market, district in MARKETS:
        rows.extend(_series(rng, market, district, "Maharashtra", CROPS, days))
    return rows


# Representative markets + regional crop mixes for the other major producing
# states, so switching location in the demo always lands on real-looking data
# even when the live data.gov.in per-state pull times out (it usually does).
STATE_FIXTURES: dict[str, tuple[list[tuple[str, str]], list[tuple[str, str, tuple[float, float]]]]] = {
    "Punjab": (
        [("Ludhiana", "Ludhiana"), ("Khanna", "Ludhiana"), ("Jalandhar", "Jalandhar")],
        [("Wheat", "Dara", (2200, 2650)), ("Paddy", "PR-126", (1900, 2400)),
         ("Maize", "Local", (1800, 2300)), ("Potato", "Local", (600, 1600))],
    ),
    "Haryana": (
        [("Karnal", "Karnal"), ("Sirsa", "Sirsa"), ("Panipat", "Panipat")],
        [("Wheat", "Dara", (2200, 2650)), ("Bajra", "Local", (2000, 2600)),
         ("Mustard", "Local", (5200, 6400)), ("Cotton", "Medium Staple", (6200, 8000))],
    ),
    "Uttar Pradesh": (
        [("Lucknow", "Lucknow"), ("Kanpur", "Kanpur"), ("Agra", "Agra")],
        [("Wheat", "Dara", (2150, 2600)), ("Paddy", "Common", (1850, 2350)),
         ("Potato", "Local", (500, 1400)), ("Sugarcane", "Local", (330, 400))],
    ),
    "Madhya Pradesh": (
        [("Indore", "Indore"), ("Ujjain", "Ujjain"), ("Bhopal", "Bhopal")],
        [("Soybean", "Yellow", (4200, 5200)), ("Wheat", "Lokwan", (2300, 2800)),
         ("Gram", "Desi", (5200, 6400)), ("Mustard", "Local", (5100, 6300))],
    ),
    "Rajasthan": (
        [("Kota", "Kota"), ("Jaipur", "Jaipur"), ("Jodhpur", "Jodhpur")],
        [("Mustard", "Local", (5200, 6600)), ("Gram", "Desi", (5200, 6500)),
         ("Coriander", "Badami", (6500, 9500)), ("Bajra", "Local", (2000, 2600))],
    ),
    "Gujarat": (
        [("Rajkot", "Rajkot"), ("Unjha", "Mehsana"), ("Ahmedabad", "Ahmedabad")],
        [("Groundnut", "Bold", (5500, 7200)), ("Cotton", "Shankar-6", (6800, 8500)),
         ("Cumin", "Local", (24000, 34000)), ("Castor", "Local", (5500, 6800))],
    ),
    "Karnataka": (
        [("Hubballi", "Dharwad"), ("Bengaluru", "Bengaluru"), ("Kalaburagi", "Kalaburagi")],
        [("Tur", "FAQ", (7000, 9800)), ("Cotton", "DCH-32", (6800, 8600)),
         ("Maize", "Local", (1900, 2400)), ("Ragi", "Local", (3200, 4200))],
    ),
    "Andhra Pradesh": (
        [("Guntur", "Guntur"), ("Kurnool", "Kurnool"), ("Vijayawada", "Krishna")],
        [("Chilli", "Teja", (12000, 22000)), ("Paddy", "Common", (1900, 2450)),
         ("Cotton", "Medium Staple", (6600, 8300)), ("Turmeric", "Finger", (7000, 12000))],
    ),
    "Telangana": (
        [("Warangal", "Warangal"), ("Nizamabad", "Nizamabad"), ("Karimnagar", "Karimnagar")],
        [("Paddy", "Common", (1900, 2450)), ("Cotton", "Medium Staple", (6600, 8300)),
         ("Maize", "Local", (1900, 2400)), ("Turmeric", "Bulb", (6500, 11000))],
    ),
    "Tamil Nadu": (
        [("Coimbatore", "Coimbatore"), ("Erode", "Erode"), ("Madurai", "Madurai")],
        [("Paddy", "ADT-43", (1950, 2500)), ("Turmeric", "Finger", (7000, 13000)),
         ("Groundnut", "Bold", (5500, 7200)), ("Banana", "Nendran", (1800, 3500))],
    ),
    "West Bengal": (
        [("Kolkata", "Kolkata"), ("Barddhaman", "Purba Bardhaman"), ("Siliguri", "Darjeeling")],
        [("Paddy", "Swarna", (1850, 2350)), ("Potato", "Jyoti", (500, 1500)),
         ("Jute", "TD-5", (4800, 6200)), ("Mustard", "Local", (5100, 6300))],
    ),
    "Bihar": (
        [("Patna", "Patna"), ("Muzaffarpur", "Muzaffarpur"), ("Gulabbagh", "Purnia")],
        [("Wheat", "Dara", (2150, 2600)), ("Maize", "Local", (1800, 2300)),
         ("Paddy", "Common", (1850, 2350)), ("Lentil", "Masoor", (5800, 7200))],
    ),
    "Odisha": (
        [("Cuttack", "Cuttack"), ("Sambalpur", "Sambalpur"), ("Bhubaneswar", "Khordha")],
        [("Paddy", "Common", (1900, 2400)), ("Maize", "Local", (1850, 2350)),
         ("Groundnut", "Bold", (5200, 6800)), ("Mustard", "Local", (5000, 6200))],
    ),
}


def generate_state_fixture_rows(state: str, days: int = 90) -> list[dict]:
    """Synthetic-but-plausible price series for one state — the demo fallback
    when the live per-state feed is unavailable. Deterministic per state."""
    spec = STATE_FIXTURES.get(state)
    if spec is None:
        return []
    markets, crops = spec
    rng = random.Random(hash(state) & 0xFFFFFFFF)
    rows: list[dict] = []
    for market, district in markets:
        rows.extend(_series(rng, market, district, state, crops, days))
    return rows
