"""LLM readability layer (v1.3): a plain-language advisor summary and the
"Ask AgriLink" assistant. Both are strictly grounded in the same rule-based
numbers the rest of the app computes — the model only rephrases / answers from
the context it is given, and every route degrades gracefully without a key.
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.price_cache import PriceCache
from app.services import llm
from app.services import reference as ref
from app.services import weather as weather_svc
from app.services.market_towns import market_coords
from app.services.geo import _district_coord
from app.services.signal import compute_signal

router = APIRouter(prefix="/api", tags=["assistant"])


def _series(db: Session, crop: str, market: str, days: int = 60) -> list[PriceCache]:
    since = date.today() - timedelta(days=days)
    return list(
        db.execute(
            select(PriceCache)
            .where(PriceCache.crop == crop, PriceCache.market == market, PriceCache.date >= since)
            .order_by(PriceCache.date.asc())
        ).scalars().all()
    )


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
    "Answer in 1-4 short sentences IN {lang}. For anything about the specific "
    "crop/market (price, whether to sell or wait, weather, MSP, calendar) use "
    "ONLY the CONTEXT below and never invent a number, date or market name — if "
    "it isn't in the context, say you don't have that information (AgriLink has "
    "no price forecasts and no traded-volume data). You MAY explain in general "
    "terms how AgriLink works: it aggregates official AGMARKNET mandi prices and "
    "gives a transparent rule-based sell/wait signal from price momentum vs the "
    "7- and 30-day averages, weather, MSP and the crop calendar. Be concrete and "
    "practical, never give financial guarantees."
)


@router.get("/advisor/summary")
def advisor_summary(
    crop: str, market: str, lang: str = "en", db: Session = Depends(get_db)
) -> dict:
    if not llm.available():
        return {"available": False, "summary": None}
    ctx = _context(db, crop, market)
    text = llm.chat(
        _SYS_SUMMARY.format(lang=llm.lang_name(lang)),
        "DATA:\n" + _as_lines(ctx),
        max_tokens=220,
    )
    return {"available": True, "summary": text, "lang": lang}


class AskBody(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    crop: str | None = None
    market: str | None = None
    lang: str = "en"


@router.post("/assistant/ask")
def assistant_ask(body: AskBody, db: Session = Depends(get_db)) -> dict:
    if not llm.available():
        return {"available": False, "answer": None}
    ctx = _context(db, body.crop, body.market) if body.crop and body.market else {}
    user = f"CONTEXT:\n{_as_lines(ctx) or '(no crop/market selected)'}\n\nQUESTION: {body.question}"
    answer = llm.chat(
        _SYS_ASSISTANT.format(lang=llm.lang_name(body.lang)),
        user,
        max_tokens=350,
        cache=False,
    )
    return {"available": True, "answer": answer, "lang": body.lang}


def _as_lines(ctx: dict) -> str:
    out = []
    for k, v in ctx.items():
        if v is None:
            continue
        out.append(f"- {k}: {v}")
    return "\n".join(out)
