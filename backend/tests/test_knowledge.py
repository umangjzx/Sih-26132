"""Grounded knowledge base + retrieval for Ask AgriLink (v1.5 #3)."""

import pytest

from app.services import knowledge


@pytest.mark.parametrize(
    "query, expect_id_prefix",
    [
        ("how does MSP procurement work", "msp-procurement"),
        ("what does FAQ grade mean", "grading-faq"),
        ("can I sell directly to a buyer without going through the mandi", "direct-buyer"),
        ("warehouse receipt loan against stored grain", "warehouse-receipt"),
        ("how is the sell or wait signal calculated", "signal-explained"),
        ("what is eNAM", "enam"),
        ("pm kisan instalment", "pm-kisan"),
    ],
)
def test_retrieval_top_hit_is_relevant(query, expect_id_prefix):
    hits = knowledge.search(query, k=3)
    assert hits, f"no hits for {query!r}"
    assert hits[0].doc.id == expect_id_prefix


def test_generated_msp_and_calendar_docs_exist():
    ids = {d.id for d in knowledge._corpus()}
    assert "msp-crop-soybean" in ids
    assert "cal-tur" in ids
    assert "grading-rubric" in ids


def test_no_msp_crop_doc_says_market_driven():
    hits = knowledge.search("is there an MSP for onion", k=5)
    onion = next((h for h in hits if h.doc.id == "msp-crop-onion"), None)
    assert onion is not None
    assert "no minimum support price" in onion.doc.text.lower()


def test_search_scores_descending_and_thresholded():
    hits = knowledge.search("MSP procurement registration token FAQ quality", k=6)
    scores = [h.score for h in hits]
    assert scores == sorted(scores, reverse=True)
    assert all(s >= 3.0 for s in scores)


def test_gibberish_returns_nothing():
    assert knowledge.search("zzzq xqwv plib", k=4) == []


def test_context_block_formats_titles():
    block = knowledge.context_block("how does MSP procurement work", k=2)
    assert "[How MSP procurement works for a farmer]" in block


def test_assistant_search_endpoint(client):
    resp = client.get("/api/assistant/search", params={"q": "warehouse receipt loan"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["results"]
    assert body["results"][0]["title"] == "Warehouse receipts and pledge finance"
    assert "text" in body["results"][0]


def test_assistant_ask_without_key_returns_reference(client, monkeypatch):
    from app.services import llm

    monkeypatch.setattr(llm, "available", lambda: False)
    resp = client.post(
        "/api/assistant/ask",
        json={"question": "how does MSP procurement work"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is False
    assert body["reference"], "expected grounded reference text even without a key"
    assert any("procurement" in r["text"].lower() for r in body["reference"])
