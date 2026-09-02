"""OCR assist — /api/ocr/lot-slip reads a slip photo into a lot draft.

The LLM vision call is always stubbed; these tests pin the parsing / clamping /
degradation behaviour, not the model.
"""

import io

import pytest

from app.api import ocr


_PNG_1PX = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06"
    b"\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05"
    b"\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _upload(name="slip.png", ctype="image/png", data=_PNG_1PX):
    return {"file": (name, io.BytesIO(data), ctype)}


def test_requires_farmer_role(buyer_client):
    r = buyer_client.post("/api/ocr/lot-slip", files=_upload())
    assert r.status_code == 403


def test_no_key_returns_unavailable(farmer_client, monkeypatch):
    monkeypatch.setattr(ocr.llm, "available", lambda: False)
    r = farmer_client.post("/api/ocr/lot-slip", files=_upload())
    assert r.status_code == 200
    assert r.json()["available"] is False


def test_rejects_non_image(farmer_client, monkeypatch):
    monkeypatch.setattr(ocr.llm, "available", lambda: True)
    r = farmer_client.post(
        "/api/ocr/lot-slip",
        files={"file": ("note.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert r.status_code == 415


def test_parses_and_normalises_fields(farmer_client, monkeypatch):
    monkeypatch.setattr(ocr.llm, "available", lambda: True)
    monkeypatch.setattr(
        ocr.llm, "vision",
        lambda *a, **k: '```json\n{"crop":"onion","quantity_kg":"1,200 kg",'
        '"grade":"faq","expected_price":"2450","available_from":"2026-10-05",'
        '"confidence":1.7}\n```',
    )
    r = farmer_client.post("/api/ocr/lot-slip", files=_upload())
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is True
    assert body["crop"] == "Onion"
    assert body["quantity_kg"] == 1200.0
    assert body["grade"] == "FAQ"
    assert body["expected_price"] == 2450.0
    assert body["available_from"] == "2026-10-05"
    assert body["confidence"] == 1.0  # clamped into 0..1


def test_unreadable_photo_degrades(farmer_client, monkeypatch):
    monkeypatch.setattr(ocr.llm, "available", lambda: True)
    monkeypatch.setattr(ocr.llm, "vision", lambda *a, **k: "I can't make anything out.")
    r = farmer_client.post("/api/ocr/lot-slip", files=_upload())
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is False
    assert body["crop"] is None
    assert body["note"]


def test_vision_none_degrades(farmer_client, monkeypatch):
    monkeypatch.setattr(ocr.llm, "available", lambda: True)
    monkeypatch.setattr(ocr.llm, "vision", lambda *a, **k: None)
    r = farmer_client.post("/api/ocr/lot-slip", files=_upload())
    assert r.status_code == 200
    assert r.json()["available"] is False
