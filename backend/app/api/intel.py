"""Market-intelligence endpoints (v1.1): weather, MSP, crop calendar, storage,
FPO discovery, best-net-market ranking, and mandi-holiday awareness.

All are public reads (no auth) — they inform the sell/wait decision that the
whole platform is built around.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.price_cache import PriceCache
from app.services import holidays as holidays_svc
from app.services import reference as ref
from app.services import weather as weather_svc
from app.services.best_market import best_markets
from app.services.market_towns import market_coords

router = APIRouter(prefix="/api", tags=["intel"])


def _resolve_point(
    market: str | None, district: str | None, lat: float | None, lon: float | None
) -> tuple[float, float]:
    from app.services.geo import _district_coord

    if lat is not None and lon is not None:
        return (lat, lon)
    if market:
        c = market_coords(market)
        if c:
            return c
    for name in (district, market):
        c = _district_coord(name or "")  # all-India district HQ coords
        if c:
            return c
    raise HTTPException(status_code=404, detail="Could not resolve a location for the request")


# --------------------------------------------------------------------------- #
# Weather
# --------------------------------------------------------------------------- #

@router.get("/weather/forecast")
def weather_forecast(
    market: str | None = None,
    district: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    include_anomaly: bool = Query(False),
    lang: str = "en",
) -> dict:
    pt = _resolve_point(market, district, lat, lon)
    fc = weather_svc.get_forecast(*pt)
    out = {"latitude": pt[0], "longitude": pt[1], **fc}
    if include_anomaly:
        out["rain_anomaly"] = weather_svc.get_rain_anomaly(*pt)

    # v1.3: translate the live English strings (OpenWeather condition + our note)
    # when a non-English UI asks and the LLM is available.
    if lang and lang.lower() != "en":
        from app.services import llm

        if llm.available():
            if out.get("note"):
                out["note"] = llm.translate(out["note"], lang)
            cur = out.get("current")
            if cur and cur.get("conditions"):
                cur["conditions"] = llm.translate(cur["conditions"], lang)
            ra = out.get("rain_anomaly")
            if ra and ra.get("note"):
                ra["note"] = llm.translate(ra["note"], lang)
    return out


# --------------------------------------------------------------------------- #
# MSP
# --------------------------------------------------------------------------- #

@router.get("/msp")
def msp(crop: str, market: str | None = None, db: Session = Depends(get_db)) -> dict:
    entry = ref.msp_for(crop)
    latest_modal: float | None = None
    if market:
        latest_modal = db.execute(
            select(PriceCache.modal_price)
            .where(PriceCache.crop == crop, PriceCache.market == market)
            .order_by(PriceCache.date.desc())
            .limit(1)
        ).scalar_one_or_none()

    if entry is None:
        return {
            "crop": crop,
            "has_msp": False,
            "note": f"{crop} is a market-driven crop with no Minimum Support Price.",
            "latest_modal_price": latest_modal,
        }

    result = {
        "crop": crop,
        "has_msp": True,
        "msp_price": entry["price"],
        "season": entry["season"],
        "unit": entry["unit"],
        "latest_modal_price": latest_modal,
    }
    if latest_modal is not None:
        gap = round(latest_modal - entry["price"], 0)
        result["gap_vs_msp"] = gap
        result["below_msp"] = latest_modal < entry["price"]
        result["note"] = (
            f"Market price at {market} is ₹{abs(gap):.0f} "
            f"{'below' if gap < 0 else 'above'} MSP."
        )
    return result


# --------------------------------------------------------------------------- #
# Crop calendar
# --------------------------------------------------------------------------- #

@router.get("/calendar")
def crop_calendar(crop: str) -> dict:
    cal = ref.calendar_for(crop)
    if cal is None:
        raise HTTPException(status_code=404, detail=f"No crop calendar for '{crop}'")
    return cal


# --------------------------------------------------------------------------- #
# Storage & FPO discovery
# --------------------------------------------------------------------------- #

@router.get("/storage/nearby")
def storage_nearby(
    district: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    state: str | None = None,
    max_km: float = Query(150.0, gt=0, le=600),
    limit: int = Query(8, ge=1, le=30),
) -> list[dict]:
    return ref.nearby_cold_storage(
        district=district, lat=lat, lon=lon, max_km=max_km, limit=limit, state=state
    )


@router.get("/fpo/nearby")
def fpo_nearby(
    district: str | None = None,
    crop: str | None = None,
    state: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    limit: int = Query(8, ge=1, le=30),
) -> list[dict]:
    return ref.nearby_fpos(
        district=district, crop=crop, limit=limit, state=state, lat=lat, lon=lon
    )


# --------------------------------------------------------------------------- #
# Best net market
# --------------------------------------------------------------------------- #

@router.get("/markets/best")
def markets_best(
    crop: str,
    market: str | None = None,
    district: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    state: str | None = None,
    limit: int = Query(10, ge=1, le=25),
    fast: bool = Query(False, description="skip OSRM routing, use straight-line distance"),
    db: Session = Depends(get_db),
) -> dict:
    origin = _resolve_point(market, district, lat, lon)
    if not state:
        from app.services.geo import nearest_state

        state = nearest_state(*origin)
    ranked = best_markets(db, crop, origin, limit=limit, use_routing=not fast, origin_state=state)
    if not ranked:
        raise HTTPException(status_code=404, detail=f"No price data for '{crop}'")
    best = ranked[0]
    here = next((r for r in ranked if r["market"] == market), None) if market else None
    note = None
    if here and best["market"] != here["market"]:
        delta = round(best["net_price_per_qtl"] - here["net_price_per_qtl"], 0)
        if delta > 0:
            note = (
                f"Selling at {best['market']} nets about ₹{delta:.0f}/quintal more than "
                f"{market} after ₹{best['transport_cost_per_qtl']:.0f}/quintal transport "
                f"({best['road_km']:.0f} km)."
            )
    from app.services.freight import freight_rate

    return {"crop": crop, "origin": {"latitude": origin[0], "longitude": origin[1]},
            "best": best, "here": here, "ranked": ranked, "note": note,
            "freight": freight_rate(state)}


# --------------------------------------------------------------------------- #
# Mandi holidays
# --------------------------------------------------------------------------- #

@router.get("/holidays/upcoming")
def holidays_upcoming(days: int = Query(30, ge=1, le=120)) -> dict:
    hs = holidays_svc.upcoming_market_holidays(date.today(), days=days)
    note = None
    if hs:
        h = hs[0]
        note = (
            f"{h['name']} is in {h['in_days']} day(s) ({h['date']}) — most APMC "
            "mandis will be closed; plan sales around it."
        )
    return {"holidays": hs, "note": note}


@router.get("/grades")
def quality_grades() -> dict:
    """The standard quality-grade rubric used on lots and buyer demands."""
    from app.services.grading import GRADES

    return {"grades": GRADES}


@router.get("/brief")
def decision_brief(
    crop: str,
    market: str | None = None,
    district: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius_km: float = Query(200.0, ge=25, le=600),
    lang: str = "en",
    db: Session = Depends(get_db),
) -> dict:
    """One orchestrated, prioritised action plan for a crop — the sell/wait
    signal, forecast, diesel-costed best market, MSP gap, weather, crop
    calendar, mandi holidays and nearby verified buyers, ranked by urgency."""
    from app.services.brief import build_brief

    try:
        return build_brief(
            db, crop=crop, market=market, district=district,
            lat=lat, lon=lon, radius_km=radius_km, lang=lang,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/logistics/freight-rate")
def freight_rate_endpoint(
    from_state: str | None = None,
    from_district: str | None = None,
    to_district: str | None = None,
    distance_km: float | None = None,
    quantity_kg: float = Query(1000, gt=0),
    db: Session = Depends(get_db),
) -> dict:
    """Diesel-indexed road-freight rate (₹/quintal/km) with its full working,
    plus a total for the given distance + load."""
    from app.services.freight import estimate_cost
    from app.services.geo import _district_coord, haversine_km, nearest_state

    state = from_state
    if not state and from_district:
        c = _district_coord(from_district)
        if c:
            state = nearest_state(*c)

    if distance_km is None and from_district and to_district:
        a, b = _district_coord(from_district), _district_coord(to_district)
        if a and b:
            distance_km = round(haversine_km(a, b), 1)

    return estimate_cost(state, distance_km, quantity_kg)
