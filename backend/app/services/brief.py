"""Decision Brief (v1.5 #2) — one orchestrated, ranked action plan for a crop.

Everything the platform already computes in isolation — price momentum, the
sell/wait signal, the price forecast, the diesel-costed best market, the MSP
gap, weather, the crop calendar, mandi holidays and nearby verified buyers —
assembled into a single prioritised list a farmer can act on top-to-bottom.

Strictly rule-based. The LLM (when configured) only phrases the two-line
summary from the numbers this module produces; the brief is complete and
correct without it.
"""

from __future__ import annotations

import re
from datetime import date, timedelta
from statistics import mean

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.demand import Demand
from app.models.lot import Lot
from app.models.price_cache import PriceCache
from app.models.user import User
from app.services import forecast as forecast_svc
from app.services import holidays as holidays_svc
from app.services import reference as ref
from app.services import weather as weather_svc
from app.services.best_market import best_markets
from app.services.freight import freight_rate
from app.services.geo import _district_coord, haversine_km, nearest_state
from app.services.market_towns import market_coords
from app.services.signal import compute_signal
from app.services import satellite as satellite_svc

# ranked-action urgency ordering
_URGENCY_RANK = {"now": 0, "soon": 1, "watch": 2}

# thresholds
_BETTER_MARKET_MIN_DELTA = 40.0   # ₹/qtl net gain worth a separate trip
_RAIN_ALERT_MM = 20.0             # 3-day rain that threatens an unshedded harvest
_BUYER_RADIUS_KM = 200.0

# Matches AdvisorDetail.tsx's classifyReason() keyword patterns — used to find
# which of sig.reasons[] actually corresponds to the factor that decided the
# recommendation, since reason order (price -> volume -> [weather] ->
# [forecast]) is not the same as "which one mattered".
_FACTOR_REASON_PATTERN = {
    "price": re.compile(r"average|day comparison", re.I),
    "arrivals": re.compile(r"arrival|volume|supply", re.I),
    "weather": re.compile(r"rain|weather|wet|dry spell|monsoon", re.I),
    "forecast": re.compile(r"trending up|trending down|next 7 days|look flat", re.I),
}


def _dominant_reason(sig) -> str | None:
    """The reason sentence matching whichever factor actually drove the
    recommendation — not just reasons[0], which is always the price-momentum
    sentence regardless of whether price was the deciding factor (e.g. a
    "sell_now" reached mostly on rising arrivals/weather while price reads
    "no strong signal either way" would otherwise show that neutral price
    sentence under a bold SELL NOW heading)."""
    if not sig or not sig.reasons:
        return None
    scored = [f for f in (sig.factors or []) if f.get("contribution")]
    if not scored:
        return sig.reasons[0]
    dominant = max(scored, key=lambda f: abs(f["contribution"]))
    pattern = _FACTOR_REASON_PATTERN.get(dominant["key"])
    if pattern:
        for r in sig.reasons:
            if pattern.search(r):
                return r
    return sig.reasons[0]


def _series(db: Session, crop: str, market: str, days: int = 90) -> list[PriceCache]:
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

    rows = _q(False) or _q(True)
    # Same lazy backfill as app/api/prices.py._fetch_series — without it, a
    # thin live-feed series (the common case; AGMARKNET's live feed only
    # carries the latest day) makes the Decision Brief say "not enough data"
    # while /api/prices/signal (backed by _fetch_series, which does backfill)
    # confidently renders sell/wait for the exact same crop+market right below
    # it on /advisor.
    from app.services import ingestion

    if rows and len({r.date for r in rows}) < ingestion.BACKFILL_MIN_REAL_DAYS:
        try:
            if ingestion.backfill_series(db, crop, market):
                rows = _q(False) or _q(True)
        except Exception:  # noqa: BLE001 - backfill is best-effort  # nosec B110
            pass
    return rows


def _nearest_market_with_data(
    db: Session, crop: str, origin: tuple[float, float], min_days: int = 7
) -> str | None:
    """The closest market with at least ``min_days`` of price history for
    ``crop`` — used as the reference market when the caller didn't name one."""
    since = date.today() - timedelta(days=90)

    def _rows_for(crop_c):
        return db.execute(
            select(
                PriceCache.market,
                func.max(PriceCache.district),
                func.count(func.distinct(PriceCache.date)).label("n"),
            )
            .where(crop_c, PriceCache.date >= since)
            .group_by(PriceCache.market)
            .having(func.count(func.distinct(PriceCache.date)) >= min_days)
        ).all()

    rows = _rows_for(PriceCache.crop == crop) or _rows_for(PriceCache.crop.ilike(crop.strip()))
    best: tuple[float, str] | None = None
    for market, district, _n in rows:
        c = market_coords(market) or _district_coord(district or "")
        if c is None:
            continue
        d = haversine_km(origin, c)
        if best is None or d < best[0]:
            best = (d, market)
    return best[1] if best else None


def _verified_buyers_nearby(
    db: Session, crop: str, origin: tuple[float, float] | None, radius_km: float
) -> list[dict]:
    rows = db.execute(
        select(Demand, User)
        .join(User, Demand.buyer_id == User.id)
        .where(Demand.status == "open", Demand.crop.ilike(crop), User.is_active.is_(True))
    ).all()
    out: list[dict] = []
    for demand, buyer in rows:
        coords = (
            (demand.latitude, demand.longitude)
            if demand.latitude is not None and demand.longitude is not None
            else _district_coord(demand.delivery_district or "")
        )
        dist = round(haversine_km(origin, coords), 1) if origin and coords else None
        if dist is not None and dist > radius_km:
            continue
        out.append(
            {
                "demand_id": demand.id,
                "buyer_name": buyer.name,
                "buyer_district": buyer.district or "",
                "buyer_verified": (getattr(buyer, "verification_status", "") == "verified"),
                "quantity_kg": demand.quantity_kg,
                "price_band": [demand.price_band_min, demand.price_band_max],
                "distance_km": dist,
            }
        )
    out.sort(key=lambda x: (not x["buyer_verified"], x["distance_km"] is None, x["distance_km"] or 0.0))
    return out


def _verified_sellers_nearby(
    db: Session, crop: str, origin: tuple[float, float] | None, radius_km: float
) -> list[dict]:
    """Buyer-perspective mirror of ``_verified_buyers_nearby`` — open lots
    (farmers with produce to sell) instead of open demands."""
    rows = db.execute(
        select(Lot, User)
        .join(User, Lot.farmer_id == User.id)
        .where(Lot.status == "open", Lot.crop.ilike(crop), User.is_active.is_(True))
    ).all()
    out: list[dict] = []
    for lot, farmer in rows:
        coords = (lot.latitude, lot.longitude) if lot.latitude is not None and lot.longitude is not None else None
        dist = round(haversine_km(origin, coords), 1) if origin and coords else None
        if dist is not None and dist > radius_km:
            continue
        out.append(
            {
                "lot_id": lot.id,
                "farmer_name": farmer.name,
                "farmer_district": farmer.district or "",
                "farmer_verified": (getattr(farmer, "verification_status", "") == "verified"),
                "quantity_kg": lot.quantity_kg,
                "expected_price": lot.expected_price,
                "distance_km": dist,
            }
        )
    out.sort(key=lambda x: (not x["farmer_verified"], x["distance_km"] is None, x["distance_km"] or 0.0))
    return out


def _confidence(total_score: int) -> str:
    a = abs(total_score)
    if a >= 4:
        return "high"
    if a >= 2:
        return "moderate"
    return "low"


def _trend_note(current: float, ma_7: float, ma_30: float | None) -> str:
    if ma_30 is None:
        return f"₹{current:.0f} now; 7-day average ₹{ma_7:.0f} (not enough history for a 30-day view)."
    diff = (current - ma_30) / ma_30 * 100 if ma_30 else 0.0
    direction = "above" if diff >= 0 else "below"
    return (
        f"₹{current:.0f} now — {abs(diff):.1f}% {direction} the 30-day average "
        f"(₹{ma_30:.0f}); 7-day average ₹{ma_7:.0f}."
    )


def build_brief(
    db: Session,
    *,
    crop: str,
    market: str | None = None,
    district: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius_km: float = _BUYER_RADIUS_KM,
    lang: str = "en",
    perspective: str = "seller",
) -> dict:
    """Assemble the ranked decision brief. Raises ValueError when the origin
    can't be resolved or there's no usable price history.

    ``perspective`` (v1.19): "seller" (default, a farmer deciding whether to
    sell) or "buyer" (a buyer deciding whether to source now or wait). Both
    read the exact same underlying price/weather/forecast/MSP analysis —
    only the recommendation label, the best-market direction (net price
    *after* transport is maximised for a seller, minimised for a buyer), and
    which counterparties get surfaced (open demands vs. open lots) differ.
    """
    is_buyer = perspective == "buyer"
    # --- resolve an origin point ---
    origin: tuple[float, float] | None = None
    if lat is not None and lon is not None:
        origin = (lat, lon)
    elif market:
        origin = market_coords(market)
    if origin is None:
        origin = _district_coord(district or market or "")
    if origin is None:
        raise ValueError("Could not resolve a location for the brief")

    state = nearest_state(*origin)

    # --- reference market + price series ---
    ref_market = market or _nearest_market_with_data(db, crop, origin)
    if not ref_market:
        raise ValueError(f"No price data for '{crop}'")
    rows = _series(db, crop, ref_market)
    if len(rows) < 7:
        raise ValueError(f"Not enough price history for '{crop}' at {ref_market}")

    prices = [r.modal_price for r in rows]
    current_price = prices[-1]
    ma_7 = mean(prices[-7:])
    ma_30 = mean(prices[-30:]) if len(prices) >= 14 else None
    as_of = rows[-1].date.isoformat()

    # --- context factors ---
    wx = None
    try:
        wx = weather_svc.get_forecast(*origin)
    except Exception:  # noqa: BLE001 — weather never blocks the brief
        wx = None
    msp = ref.msp_for(crop)
    cal = ref.calendar_for(crop, state=state)
    fc = forecast_svc.forecast_prices([(r.date, r.modal_price) for r in rows], 30)
    sig = compute_signal(rows, weather=wx, msp=msp, forecast=fc)

    # --- diesel-costed best market ---
    # Fetched wide (12, not the usual top-6) so a buyer's ascending re-sort
    # still has real candidates to pick the cheapest delivered market from,
    # not just the top-6-for-a-seller subset.
    ranked = best_markets(db, crop, origin, limit=12, use_routing=False, origin_state=state)
    ranked_for_view = (
        sorted(ranked, key=lambda r: r["net_price_per_qtl"]) if is_buyer else ranked
    )
    here = next((r for r in ranked_for_view if r["market"] == ref_market), None)
    best_alt = ranked_for_view[0] if ranked_for_view else None
    better_market = None
    if best_alt and here and best_alt["market"] != here["market"]:
        # seller: alt nets *more*; buyer: alt costs *less* delivered.
        delta = round(
            (best_alt["net_price_per_qtl"] - here["net_price_per_qtl"]) * (-1 if is_buyer else 1), 0
        )
        if delta >= _BETTER_MARKET_MIN_DELTA:
            better_market = {**best_alt, "net_gain_per_qtl": delta}

    holiday = None
    hs = holidays_svc.upcoming_market_holidays(date.today(), days=14)
    if hs:
        holiday = hs[0]

    counterparties = (
        _verified_sellers_nearby(db, crop, origin, radius_km)
        if is_buyer
        else _verified_buyers_nearby(db, crop, origin, radius_km)
    )

    # v1.12: optional satellite crop-health context — informational only,
    # never blocks the brief and never drives the sell/wait actions above.
    crop_health = None
    try:
        crop_health = satellite_svc.get_ndvi(*origin)
    except Exception:  # noqa: BLE001 — satellite data never blocks the brief
        crop_health = None

    # --- build the ranked action list ---
    # v1.19: a buyer reads the *same* price/forecast analysis a seller does —
    # a market trending up is exactly as urgent to lock in for a buyer (before
    # it rises further) as it is for a seller (while it's still high) — only
    # the label flips. Rain-risk (protecting an unharvested crop) and storage
    # (holding your own stock) are genuinely seller-only concerns and are
    # skipped for a buyer rather than stretched into a false equivalence.
    actions: list[dict] = []
    rec = sig.recommendation if sig else "hold"

    if is_buyer:
        if rec == "sell_now":
            actions.append({
                "kind": "buy_now", "urgency": "now", "title": "Buy now — price is trending up",
                "detail": (
                    f"{_trend_note(current_price, ma_7, ma_30)} Waiting is likely to cost "
                    "more per quintal — lock a deal or forward contract now."
                ),
            })
        elif rec == "wait":
            actions.append({
                "kind": "wait_to_buy", "urgency": "watch", "title": "Wait — price looks weak and may fall further",
                "detail": (
                    f"{_trend_note(current_price, ma_7, ma_30)} Holding off before locking "
                    "a deal could save you money."
                ),
            })
        else:
            actions.append({
                "kind": "hold", "urgency": "soon", "title": "No urgency — buy on your schedule",
                "detail": "No strong signal either way; the factors roughly cancel out.",
            })
    elif rec == "sell_now":
        actions.append({
            "kind": "sell", "urgency": "now", "title": "Sell now",
            "detail": (_dominant_reason(sig) or
                       "Price momentum favours selling at today's rate."),
        })
    elif rec == "wait":
        actions.append({
            "kind": "wait", "urgency": "watch", "title": "Hold — prices look weak",
            "detail": (_dominant_reason(sig) or
                       "Today's price is depressed versus its recent average."),
        })
    else:
        actions.append({
            "kind": "hold", "urgency": "soon", "title": "No urgency — sell on your schedule",
            "detail": "No strong signal either way; the factors roughly cancel out.",
        })

    if sig and sig.msp and sig.msp.get("below"):
        if is_buyer:
            actions.append({
                "kind": "msp", "urgency": "watch", "title": "Price is below MSP",
                "detail": (
                    f"₹{abs(sig.msp['gap']):.0f}/qtl below the Minimum Support Price "
                    f"(₹{sig.msp['price']:.0f}) — farmers may hold out for government "
                    "procurement instead of selling here."
                ),
            })
        else:
            actions.append({
                "kind": "msp", "urgency": "now", "title": "Price is below MSP — use a procurement centre",
                "detail": (
                    f"₹{abs(sig.msp['gap']):.0f}/qtl below the Minimum Support Price "
                    f"(₹{sig.msp['price']:.0f}). A government centre should pay MSP — "
                    "don't sell to a private trader below it."
                ),
            })

    if better_market:
        if is_buyer:
            actions.append({
                "kind": "best_market", "urgency": "now" if rec == "sell_now" else "soon",
                "title": f"Source from {better_market['market']} instead — saves ₹{better_market['net_gain_per_qtl']:.0f}/qtl delivered",
                "detail": (
                    f"₹{better_market['net_price_per_qtl']:.0f}/qtl delivered there (mandi price + "
                    f"₹{better_market['transport_cost_per_qtl']:.0f}/qtl diesel-indexed freight over "
                    f"{better_market['road_km']:.0f} km), versus ₹{here['net_price_per_qtl']:.0f}/qtl at {ref_market}."
                ),
            })
        else:
            actions.append({
                "kind": "best_market", "urgency": "now" if rec == "sell_now" else "soon",
                "title": f"Truck to {better_market['market']} — nets ₹{better_market['net_gain_per_qtl']:.0f}/qtl more",
                "detail": (
                    f"₹{better_market['net_price_per_qtl']:.0f}/qtl net there after "
                    f"₹{better_market['transport_cost_per_qtl']:.0f}/qtl diesel-indexed "
                    f"freight over {better_market['road_km']:.0f} km, versus "
                    f"₹{here['net_price_per_qtl']:.0f}/qtl at {ref_market}."
                ),
            })

    if holiday and holiday["in_days"] <= 5:
        actions.append({
            "kind": "holiday",
            "urgency": "now" if holiday["in_days"] <= 2 else "soon",
            "title": f"{holiday['name']} closes mandis in {holiday['in_days']} day(s)",
            "detail": (
                f"APMC markets will likely be shut on {holiday['date']} — "
                + ("source before, or plan the trip for after." if is_buyer
                   else "sell before, or plan the trip for after.")
            ),
        })

    if not is_buyer:
        rain_mm = (wx or {}).get("next3_rain_mm")
        if rain_mm is not None and rain_mm >= _RAIN_ALERT_MM:
            actions.append({
                "kind": "weather", "urgency": "now",
                "title": f"Rain coming — about {rain_mm:.0f} mm over 3 days",
                "detail": "Shed or dry the harvest and move it to market before quality drops.",
            })

    if cal and cal.get("glut_risk"):
        if is_buyer:
            actions.append({
                "kind": "calendar", "urgency": "watch",
                "title": "Peak-arrivals season — good time to source",
                "detail": (
                    f"{cal['current_phase'].capitalize()}. Prices tend to soften as more farmers "
                    f"bring in the harvest. {cal.get('note', '')}"
                ).strip(),
            })
        else:
            actions.append({
                "kind": "calendar", "urgency": "soon",
                "title": "Peak-arrivals season — expect prices to soften",
                "detail": f"{cal['current_phase'].capitalize()}. {cal.get('note', '')}".strip(),
            })

    if counterparties:
        if is_buyer:
            vcount = sum(1 for c in counterparties if c["farmer_verified"])
            actions.append({
                "kind": "sellers", "urgency": "soon",
                "title": (
                    f"{len(counterparties)} farmer(s) offering {crop} within {radius_km:.0f} km"
                    + (f" ({vcount} verified)" if vcount else "")
                ),
                "detail": (
                    "Open a direct deal instead of the mandi — top match: "
                    f"{counterparties[0]['farmer_name']}"
                    + (f", {counterparties[0]['distance_km']:.0f} km" if counterparties[0]['distance_km'] is not None else "")
                    + f", asking ₹{counterparties[0]['expected_price']:.0f}/qtl."
                ),
            })
        else:
            vcount = sum(1 for c in counterparties if c["buyer_verified"])
            actions.append({
                "kind": "buyers", "urgency": "soon",
                "title": (
                    f"{len(counterparties)} buyer(s) seeking {crop} within {radius_km:.0f} km"
                    + (f" ({vcount} verified)" if vcount else "")
                ),
                "detail": (
                    "Open a direct deal instead of the mandi — top match: "
                    f"{counterparties[0]['buyer_name']}"
                    + (f", {counterparties[0]['distance_km']:.0f} km" if counterparties[0]['distance_km'] is not None else "")
                    + f", ₹{counterparties[0]['price_band'][0]:.0f}–{counterparties[0]['price_band'][1]:.0f}/qtl."
                ),
            })

    storage: list[dict] = []
    if not is_buyer and rec in ("wait", "hold"):
        storage = ref.nearby_cold_storage(
            district=district, lat=origin[0], lon=origin[1], max_km=200, limit=3
        )
        if storage:
            s0 = storage[0]
            km = s0.get("distance_km")
            where = f"about {km:.0f} km away" if km else "in your area"
            actions.append({
                "kind": "storage", "urgency": "watch",
                "title": f"If you hold, storage is {where}",
                "detail": f"{s0['name']} ({s0.get('type', 'storage')}), {s0.get('district', '')}.",
            })

    actions.sort(key=lambda a: _URGENCY_RANK.get(a["urgency"], 3))
    for i, a in enumerate(actions, 1):
        a["rank"] = i

    # The buyer's headline label is the mirror of the seller's, not the raw
    # sig.recommendation — a buyer reading "SELL NOW" on their own brief would
    # be reading someone else's instruction.
    _BUYER_ACTION = {"sell_now": "buy_now", "wait": "wait_to_buy", "hold": "hold"}
    headline_action = _BUYER_ACTION[rec] if is_buyer else rec

    brief = {
        "crop": crop,
        "reference_market": ref_market,
        "district": rows[-1].district,
        "state": rows[-1].state or state,
        "as_of": as_of,
        "origin": {"latitude": origin[0], "longitude": origin[1]},
        "perspective": perspective,
        "headline": {
            "action": headline_action,
            "score": sig.total_score if sig else 0,
            "confidence": _confidence(sig.total_score if sig else 0),
        },
        "price": {
            "latest_per_qtl": round(current_price, 0),
            "ma_7": round(ma_7, 0),
            "ma_30": round(ma_30, 0) if ma_30 is not None else None,
            "trend_note": _trend_note(current_price, ma_7, ma_30),
        },
        "signal": {
            "recommendation": rec,
            "total_score": sig.total_score if sig else 0,
            "factors": sig.factors if sig else [],
            "reasons": sig.reasons if sig else [],
        },
        "forecast": {
            "available": fc.available,
            "change_pct_7d": fc.change_pct_7d,
            "note": fc.note or None,
        },
        "best_market": {
            "here": here,
            "best": best_alt,
            "better_alternative": better_market,
            "freight": freight_rate(state),
        },
        "msp": sig.msp if sig else None,
        "weather": (
            {
                "note": wx.get("note"),
                "next3_rain_mm": wx.get("next3_rain_mm"),
                "sell_bias": wx.get("sell_bias"),
            }
            if wx and wx.get("source") not in (None, "unavailable")
            else None
        ),
        "calendar": cal,
        "holiday": holiday,
        "crop_health": crop_health,
        "counterparties_nearby": {"count": len(counterparties), "top": counterparties[:5]},
        "storage_nearby": storage,
        "actions": actions,
    }
    brief["summary"] = _summarise(brief, lang)
    return brief


def _rule_summary(brief: dict) -> str:
    top = brief["actions"][:2]
    lead = top[0]["title"] if top else "No action needed right now."
    second = f" Then: {top[1]['title'].lower()}." if len(top) > 1 else ""
    conf = brief["headline"]["confidence"]
    return (
        f"{lead} (confidence: {conf}, based on price momentum, weather, forecast "
        f"and MSP).{second}"
    )


def _summarise(brief: dict, lang: str) -> str:
    """LLM phrasing when configured; a deterministic sentence otherwise."""
    from app.services import llm

    fallback = _rule_summary(brief)
    if not llm.available():
        return fallback
    lines = [
        f"crop: {brief['crop']}",
        f"reference market: {brief['reference_market']}",
        f"recommendation: {brief['headline']['action']} "
        f"(score {brief['headline']['score']}, {brief['headline']['confidence']} confidence)",
        f"price: {brief['price']['trend_note']}",
    ]
    for a in brief["actions"][:5]:
        lines.append(f"action {a['rank']} [{a['urgency']}]: {a['title']} — {a['detail']}")
    try:
        text = llm.chat(
            (
                "You are AgriLink's advisor. Given a farmer's ranked decision brief "
                f"as structured data, write 2-3 short sentences of plain advice IN "
                f"{llm.lang_name(lang)}. Use ONLY the facts given, lead with the top "
                "action, no headings or lists."
            ),
            "BRIEF:\n" + "\n".join(lines),
            max_tokens=200,
        )
        return text.strip() or fallback
    except Exception:  # noqa: BLE001 — never let phrasing break the brief
        return fallback
