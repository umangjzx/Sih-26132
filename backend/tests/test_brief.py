"""Decision Brief orchestration (v1.5 #2)."""

import pytest

from app.services.brief import build_brief


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


def test_brief_freight_block_is_diesel_indexed(seeded_db):
    b = build_brief(seeded_db, crop="Onion", market="Pune")
    fr = b["best_market"]["freight"]
    assert fr["rate_per_qtl_km"] > 0
    assert round(fr["breakdown"]["handling"] + fr["breakdown"]["fuel"], 3) == fr["rate_per_qtl_km"]


def test_brief_endpoint_ok(client):
    resp = client.get("/api/brief", params={"crop": "Onion", "market": "Pune"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["headline"]["action"] in {"sell_now", "wait", "hold"}
    assert "actions" in body and isinstance(body["actions"], list)


def test_brief_endpoint_404_for_thin_history(client):
    resp = client.get("/api/brief", params={"crop": "Onion", "market": "Nowhere APMC"})
    assert resp.status_code == 404
