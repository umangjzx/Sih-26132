"""LLM readability layer (v1.3): a plain-language advisor summary and the
"Ask AgriLink" assistant. Both are strictly grounded in the same rule-based
numbers the rest of the app computes — the model only rephrases / answers from
the context it is given, and every route degrades gracefully without a key.
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import ratelimit
from app.core.database import get_db
from app.models.price_cache import PriceCache
from app.services import llm
from app.services import reference as ref
from app.services import weather as weather_svc
from app.services.market_towns import market_coords
from app.services.geo import _district_coord
from app.services.signal import compute_signal

router = APIRouter(prefix="/api", tags=["assistant"])

# LLM-backed public endpoints — a per-IP valve so a script can't run up the
# OpenRouter bill (/assistant/ask is deliberately uncached).
_ASK_LIMIT, _ASK_WINDOW_S = 15, 60
_SUMMARY_LIMIT, _SUMMARY_WINDOW_S = 40, 60


def _guard(request: Request, name: str, limit: int, window_s: int) -> None:
    ip = request.client.host if request.client else "unknown"
    if not ratelimit.check(f"assistant:{name}:{ip}", limit=limit, window_s=window_s):
        raise HTTPException(status_code=429, detail="Too many requests — please wait a moment.")


def _series(db: Session, crop: str, market: str, days: int = 60) -> list[PriceCache]:
    since = date.today() - timedelta(days=days)

    def _q(ci: bool) -> list[PriceCache]:
        crop_c = PriceCache.crop.ilike(crop.strip()) if ci else PriceCache.crop == crop
        mkt_c = PriceCache.market.ilike(market.strip()) if ci else PriceCache.market == market
        return list(
            db.execute(
                select(PriceCache)
                .where(crop_c, mkt_c, PriceCache.date >= since)
                .order_by(PriceCache.date.asc())
            ).scalars().all()
        )

    return _q(False) or _q(True)


def _context(db: Session, crop: str, market: str) -> dict:
    """Everything the LLM is allowed to reason from — plain values, no prose."""
    rows = _series(db, crop, market)
    ctx: dict = {"crop": crop, "market": market}
    if rows:
        last = rows[-1]
        ctx["district"] = last.district
        ctx["state"] = last.state
        ctx["latest_price_per_qtl"] = last.modal_price
        ctx["as_of"] = last.date.isoformat()

    pt = market_coords(market)
    if pt is None and rows:
        pt = _district_coord(rows[-1].district or "")
    wx = None
    if pt is not None:
        try:
            wx = weather_svc.get_forecast(*pt)
        except Exception:  # noqa: BLE001
            wx = None
    msp = ref.msp_for(crop)
    cal = ref.calendar_for(crop)

    sig = compute_signal(rows, weather=wx, msp=msp) if len(rows) >= 7 else None
    if sig:
        ctx["recommendation"] = sig.recommendation
        ctx["reasons"] = sig.reasons
        ctx["moving_avg_7d"] = round(sig.ma_7)
        ctx["moving_avg_30d"] = round(sig.ma_30) if sig.ma_30 else None
    if wx and wx.get("source") not in (None, "unavailable"):
        ctx["weather_note"] = wx.get("note")
        ctx["rain_next_3_days_mm"] = wx.get("next3_rain_mm")
        if wx.get("current"):
            ctx["weather_now"] = {
                k: wx["current"].get(k) for k in ("temp_c", "conditions", "humidity_pct")
            }
    if msp:
        ctx["msp_per_qtl"] = msp["price"]
        ctx["msp_season"] = msp.get("season")
    elif msp is None:
        ctx["msp"] = "none (market-driven crop)"
    if cal:
        ctx["crop_calendar"] = {
            "current_phase": cal["current_phase"],
            "glut_risk": cal["glut_risk"],
            "peak_arrivals": cal["peak_arrival_months"],
        }
    return ctx


_SYS_SUMMARY = (
    "You are AgriLink's advisor. You are given a farmer's crop, market and the "
    "platform's rule-based sell/wait analysis as structured data. Write 2-3 short "
    "sentences of plain, encouraging advice IN {lang}. Use only the numbers given "
    "— never invent prices or facts. Mention the recommendation, the single most "
    "important reason, and (if relevant) the MSP or weather. No headings, no lists."
)

_SYS_ASSISTANT = (
    "You are AgriLink, a mandi-price assistant for Indian farmers and buyers. "
    "Answer in 1-5 short sentences IN {lang}. For anything about the specific "
    "crop/market (price, whether to sell or wait, weather, MSP, calendar) use "
    "ONLY the CONTEXT below and never invent a number, date or market name — if "
    "it isn't in the context, say you don't have that information (AgriLink has "
    "no price forecasts and no traded-volume data). For how-it-works and policy "
    "questions (MSP procurement, APMC/eNAM, FPOs, grading, warehouse receipts, "
    "schemes, how AgriLink computes its signal or freight) you MAY use the "
    "REFERENCE section below — treat it as trusted background and summarise it in "
    "plain words. If neither section covers the question, say so briefly. Be "
    "concrete and practical, never give financial guarantees."
)


@router.get("/advisor/summary")
def advisor_summary(
    request: Request,
    crop: str, market: str, lang: str = "en", db: Session = Depends(get_db)
) -> dict:
    if not llm.available():
        return {"available": False, "summary": None}
    _guard(request, "summary", _SUMMARY_LIMIT, _SUMMARY_WINDOW_S)
    ctx = _context(db, crop, market)
    text = llm.chat(
        _SYS_SUMMARY.format(lang=llm.lang_name(lang)),
        "DATA:\n" + _as_lines(ctx),
        max_tokens=220,
    )
    return {"available": True, "summary": text, "lang": lang}


class AskBody(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    crop: str | None = Field(default=None, max_length=120)
    market: str | None = Field(default=None, max_length=120)
    lang: str = Field(default="en", max_length=8)


@router.post("/assistant/ask")
def assistant_ask(body: AskBody, request: Request, db: Session = Depends(get_db)) -> dict:
    from app.services import knowledge

    _guard(request, "ask", _ASK_LIMIT, _ASK_WINDOW_S)
    hits = knowledge.search(body.question, k=4)
    sources = [{"title": h.doc.title, "topic": h.doc.topic, "score": h.score} for h in hits]

    if not llm.available():
        # No key: still return the grounded reference text so the client can show
        # something useful instead of nothing.
        if hits:
            return {
                "available": False,
                "answer": None,
                "reference": [{"title": h.doc.title, "text": h.doc.text} for h in hits],
                "sources": sources,
            }
        return {"available": False, "answer": None, "sources": []}

    ctx = _context(db, body.crop, body.market) if body.crop and body.market else {}
    reference = "\n\n".join(f"[{h.doc.title}]\n{h.doc.text}" for h in hits)
    user = (
        f"CONTEXT:\n{_as_lines(ctx) or '(no crop/market selected)'}\n\n"
        f"REFERENCE:\n{reference or '(no matching reference)'}\n\n"
        f"QUESTION: {body.question}"
    )
    answer = llm.chat(
        _SYS_ASSISTANT.format(lang=llm.lang_name(body.lang)),
        user,
        max_tokens=380,
        cache=False,
    )
    return {"available": True, "answer": answer, "lang": body.lang, "sources": sources}


@router.get("/assistant/search")
def assistant_search(q: str, k: int = 5) -> dict:
    """Transparency endpoint: which knowledge-base chunks a question retrieves,
    with scores. Works with or without an LLM key."""
    from app.services import knowledge

    k = max(1, min(k, 10))
    hits = knowledge.search(q, k=k)
    return {
        "query": q,
        "results": [
            {"title": h.doc.title, "topic": h.doc.topic, "score": h.score, "text": h.doc.text}
            for h in hits
        ],
    }


def _as_lines(ctx: dict) -> str:
    out = []
    for k, v in ctx.items():
        if v is None:
            continue
        out.append(f"- {k}: {v}")
    return "\n".join(out)
