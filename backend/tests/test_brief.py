"""Decision Brief orchestration (v1.5 #2)."""

from datetime import date

import pytest

from app.models.price_cache import PriceCache
from app.services.brief import _dominant_reason, build_brief
from app.services.signal import SellWaitSignal


def test_brief_assembles_for_seeded_market(seeded_db):
    b = build_brief(seeded_db, crop="Onion", market="Pune")
    assert b["crop"] == "Onion"
    assert b["reference_market"] == "Pune"
    assert b["headline"]["action"] in {"sell_now", "wait", "hold"}
    assert b["price"]["latest_per_qtl"] > 0
    # the action plan always has at least the primary sell/wait row, ranked
    assert b["actions"], "expected at least one ranked action"
    assert b["actions"][0]["rank"] == 1
    ranks = [a["rank"] for a in b["actions"]]
    assert ranks == sorted(ranks)
    # a rule-composed summary is always present (LLM off in tests)
    assert isinstance(b["summary"], str) and b["summary"]


def test_brief_actions_sorted_by_urgency(seeded_db):
    b = build_brief(seeded_db, crop="Tomato", market="Lasalgaon")
    order = {"now": 0, "soon": 1, "watch": 2}
    seq = [order[a["urgency"]] for a in b["actions"]]
    assert seq == sorted(seq)


def test_brief_infers_reference_market_from_location(seeded_db):
    # no market given — nearest seeded market with history is picked
    b = build_brief(seeded_db, crop="Onion", district="Pune")
    assert b["reference_market"] in {"Pune", "Lasalgaon", "Ahmednagar", "Solapur", "Nagpur"}


def test_brief_unknown_crop_raises(seeded_db):
    with pytest.raises(ValueError):
        build_brief(seeded_db, crop="Dragonfruit", market="Pune")


def test_brief_matches_crop_and_market_case_insensitively(seeded_db):
    b = build_brief(seeded_db, crop="onion", market="pune")
    assert b["crop"] == "onion"
    assert b["reference_market"] == "pune"
    assert b["price"]["latest_per_qtl"] > 0


def test_brief_freight_block_is_diesel_indexed(seeded_db):
    b = build_brief(seeded_db, crop="Onion", market="Pune")
    fr = b["best_market"]["freight"]
    assert fr["rate_per_qtl_km"] > 0
    assert round(fr["breakdown"]["handling"] + fr["breakdown"]["fuel"], 3) == fr["rate_per_qtl_km"]


def test_brief_backfills_thin_history_instead_of_raising(db):
    """A crop+market with only today's row (the shape a fresh live-feed pull
    actually has) used to make the Decision Brief raise "not enough price
    history", while /api/prices/signal (whose _fetch_series already backfills)
    confidently renders sell/wait for the exact same pair right below it on
    /advisor. brief.py's own _series() must backfill the same way."""
    db.add(PriceCache(crop="Onion", variety="Local", market="Pune", district="Pune",
                      state="Maharashtra", date=date.today(),
                      min_price=1900, max_price=2100, modal_price=2000, arrival_volume=None))
    db.commit()

    b = build_brief(db, crop="Onion", market="Pune", lat=18.5204, lon=73.8567)
    assert b["reference_market"] == "Pune"
    assert b["headline"]["action"] in {"sell_now", "wait", "hold"}


def test_dominant_reason_picks_the_factor_that_actually_decided():
    """reasons[0] is always the price-momentum sentence regardless of whether
    price was the deciding factor — _dominant_reason must instead pick the
    reason matching whichever factor's contribution actually swung the
    recommendation."""
    sig = SellWaitSignal(
        recommendation="sell_now",
        reasons=[
            "Today's price (₹2000) is close to the 30-day average (₹1980) — "
            "no strong price signal either way.",
            "Arrivals are rising sharply — a glut is likely soon, sell before prices fall.",
        ],
        current_price=2000, ma_7=1990, ma_30=1980, volume_trend_pct=20.0, days_of_data=30,
        total_score=1,
        factors=[
            {"key": "price", "weight": 2, "score": 0, "contribution": 0},
            {"key": "arrivals", "weight": 1, "score": 1, "contribution": 1},
            {"key": "weather", "weight": 1, "score": 0, "contribution": 0},
            {"key": "forecast", "weight": 1, "score": 0, "contribution": 0},
        ],
    )
    assert "Arrivals are rising" in _dominant_reason(sig)


def test_dominant_reason_falls_back_to_first_when_no_factors():
    sig = SellWaitSignal(
        recommendation="sell_now", reasons=["Only reason available."],
        current_price=2000, ma_7=1990, ma_30=1980, volume_trend_pct=None, days_of_data=30,
        total_score=2, factors=None,
    )
    assert _dominant_reason(sig) == "Only reason available."


def test_brief_endpoint_ok(client):
    resp = client.get("/api/brief", params={"crop": "Onion", "market": "Pune"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["headline"]["action"] in {"sell_now", "wait", "hold"}
    assert "actions" in body and isinstance(body["actions"], list)


def test_brief_endpoint_404_for_thin_history(client):
    resp = client.get("/api/brief", params={"crop": "Onion", "market": "Nowhere APMC"})
    assert resp.status_code == 404


def test_brief_endpoint_is_rate_limited(client):
    params = {"crop": "Onion", "market": "Pune"}
    codes = [client.get("/api/brief", params=params).status_code for _ in range(33)]
    assert codes.count(200) == 30
    assert codes[-1] == 429
