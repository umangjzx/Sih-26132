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


def generate_fixture_rows(days: int = 90, seed: int = 26132) -> list[dict]:
    rng = random.Random(seed)
    rows: list[dict] = []
    today = date.today()

    for market, district in MARKETS:
        for crop, variety, (low, high) in CROPS:
            price = rng.uniform(low, high)
            for offset in range(days, -1, -1):
                day = today - timedelta(days=offset)
                drift = rng.uniform(-0.015, 0.018)
                price = max(low * 0.6, min(high * 1.4, price * (1 + drift)))
                spread = price * rng.uniform(0.04, 0.09)
                min_price = round(price - spread / 2, 2)
                max_price = round(price + spread / 2, 2)
                modal_price = round(price, 2)
                arrival_volume = round(max(5.0, rng.gauss(120, 35) * (1.4 if day.weekday() in (0, 3) else 1.0)), 1)
                rows.append(
                    {
                        "crop": crop,
                        "variety": variety,
                        "market": market,
                        "district": district,
                        "state": "Maharashtra",
                        "date": day,
                        "min_price": min_price,
                        "max_price": max_price,
                        "modal_price": modal_price,
                        "arrival_volume": arrival_volume,
                    }
                )
    return rows
