"""v1.3 LLM readability layer. The LLM is mocked — we only check that the routes
are grounded in real context and degrade cleanly without a key.
"""

from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app
from app.models.price_cache import PriceCache
from app.services import llm


def _client(db):
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _seed(db, crop="Onion", market="Pune", n=20, modal=2000):
    for i in range(n):
        d = date.today() - timedelta(days=i)
        db.add(PriceCache(crop=crop, variety="Local", market=market, district="Pune",
                          state="Maharashtra", date=d, min_price=modal - 100,
                          max_price=modal + 100, modal_price=modal, arrival_volume=None))
    db.commit()


def test_summary_and_ask_degrade_without_key(db, monkeypatch):
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "")
    client = _client(db)
    try:
        r = client.get("/api/advisor/summary", params={"crop": "Onion", "market": "Pune"})
        assert r.json() == {"available": False, "summary": None}
        r = client.post("/api/assistant/ask", json={"question": "sell now?"})
        assert r.json() == {"available": False, "answer": None}
    finally:
        app.dependency_overrides.clear()


def test_summary_is_grounded_in_real_context(db, monkeypatch):
    _seed(db)
    captured = {}

    def fake_chat(system, user, **kw):
        captured["system"] = system
        captured["user"] = user
        return "Prices are strong — a good time to sell."

    monkeypatch.setattr(llm.settings, "openrouter_api_key", "x")
    monkeypatch.setattr(llm, "chat", fake_chat)
    client = _client(db)
    try:
        r = client.get("/api/advisor/summary",
                       params={"crop": "Onion", "market": "Pune", "lang": "hi"})
        body = r.json()
        assert body["available"] is True
        assert body["summary"] == "Prices are strong — a good time to sell."
        # the prompt carried the real computed figures, not prose
        assert "latest_price_per_qtl: 2000" in captured["user"]
        assert "recommendation:" in captured["user"]
        assert "Hindi" in captured["system"]
    finally:
        app.dependency_overrides.clear()


def test_ask_passes_context_and_question(db, monkeypatch):
    _seed(db, crop="Tomato", market="Nashik", modal=1500)
    seen = {}
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "x")
    monkeypatch.setattr(llm, "chat",
                        lambda s, u, **kw: seen.update(u=u) or "It depends on your storage.")
    client = _client(db)
    try:
        r = client.post("/api/assistant/ask", json={
            "question": "Can I store tomatoes?", "crop": "Tomato",
            "market": "Nashik", "lang": "en",
        })
        assert r.json()["answer"] == "It depends on your storage."
        assert "QUESTION: Can I store tomatoes?" in seen["u"]
        assert "latest_price_per_qtl: 1500" in seen["u"]
    finally:
        app.dependency_overrides.clear()
