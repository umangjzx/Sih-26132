import secrets
import threading
import time
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import ratelimit
from app.core.config import settings
from app.core.database import get_db
from app.models.price_cache import PriceCache
from app.schemas.price import (
    CropMarketOption,
    ForecastPointOut,
    IngestionResultResponse,
    NearestMarketComparison,
    PriceForecastResponse,
    PricePoint,
    PriceTrendResponse,
    SecondOpinionOut,
    SellWaitSignalResponse,
)
from app.services import forecast as forecast_svc
from app.services import ingestion, reference, weather
from app.services.geo import _district_coord, district_distance_km
from app.services.market_towns import market_coords
from app.services.signal import compute_signal

router = APIRouter(prefix="/api", tags=["prices"])


# In-process cache for the distinct crop/market list behind GET /api/options.
# The underlying PriceCache table only changes on a 6-hourly ingestion tick, but
# the DISTINCT-over-4-columns query it powers scans the whole table on every
# call — measured at ~4.4s p50 against the full seeded dataset (20k+ combos),
# vs 50-90ms for the app's other endpoints (see scripts/perf_bench.py). A short
# TTL cache, keyed by the `state` filter, avoids re-scanning on every request
# without adding infrastructure — consistent with the existing in-process
# rate limiter (app/core/ratelimit.py), which makes the same single-worker
# trade-off. Invalidated eagerly at the end of a successful ingestion run.
_OPTIONS_TTL_S = 900.0
_options_lock = threading.Lock()
_options_cache: dict[str | None, tuple[float, list[CropMarketOption]]] = {}


_sorted_options_cache: dict[str | None, tuple[float, list[CropMarketOption]]] = {}


def invalidate_options_cache() -> None:
    with _options_lock:
        _options_cache.clear()
        _sorted_options_cache.clear()


def _cached_base_options(db: Session, state: str | None) -> list[CropMarketOption]:
    now = time.monotonic()
    with _options_lock:
        hit = _options_cache.get(state)
        if hit is not None and now - hit[0] < _OPTIONS_TTL_S:
            return hit[1]

    stmt = select(
        PriceCache.crop, PriceCache.market, PriceCache.district, PriceCache.state
    ).distinct()
    if state:
        stmt = stmt.where(PriceCache.state == state)
    rows = db.execute(stmt).all()
    opts = [
        CropMarketOption(crop=r.crop, market=r.market, district=r.district, state=r.state or "")
        for r in rows
    ]

    with _options_lock:
        _options_cache[state] = (now, opts)
    return opts


@router.get("/options", response_model=list[CropMarketOption])
def list_options(
    state: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius_km: float | None = Query(None, gt=0, le=3000),
    db: Session = Depends(get_db),
) -> list[CropMarketOption]:
    # copy: downstream code mutates via list.sort()/filtering, cache entry must not
    opts = list(_cached_base_options(db, state))

    # When the caller shares a location, order markets nearest-first (and crops
    # by how close their nearest market is) so a big state's picker is usable.
    # With `radius_km` we also *drop* markets/crops outside that range so a
    # farmer near Coimbatore never sees a mandi 400 km away in the picker.
    if lat is not None and lon is not None:
        from app.services.geo import _district_coord, haversine_km

        origin = (lat, lon)
        cache: dict[tuple[str, str], float] = {}

        def dkey(o: CropMarketOption) -> float:
            k = (o.market, o.district)
            if k not in cache:
                c = market_coords(o.market) or _district_coord(o.district)
                cache[k] = haversine_km(origin, c) if c else float("inf")
            return cache[k]

        if radius_km is not None:
            in_range = [o for o in opts if dkey(o) <= radius_km]
            if in_range:
                opts = in_range
            else:
                # Nothing placeable within range (sparse data / bad geo) — fall
                # back to the 25 nearest so the page still works.
                placeable = [o for o in opts if dkey(o) != float("inf")]
                opts = sorted(placeable, key=dkey)[:25] or opts

        best_for_crop: dict[str, float] = {}
        markets_per_crop: dict[str, int] = {}
        for o in opts:
            best_for_crop[o.crop] = min(best_for_crop.get(o.crop, float("inf")), dkey(o))
            markets_per_crop[o.crop] = markets_per_crop.get(o.crop, 0) + 1
        # Nearest first, but within the same ~25 km band lead with staple crops
        # and the ones reported in the most markets — so the picker opens on
        # Onion/Tomato, not "Amaranthus".
        opts.sort(key=lambda o: (
            int(min(best_for_crop[o.crop], 9_999) // 25),
            _staple_rank(o.crop),
            -markets_per_crop[o.crop],
            o.crop,
            dkey(o),
            o.market,
        ))
    else:
        # No location: the sort has no per-request input (no lat/lon/radius), so
        # its output is identical for every caller sharing this `state` filter
        # until the base data changes — cache it too, same TTL/invalidation as
        # the base query. Sorting is CPU-bound (a Python key fn over 20k+ rows),
        # so this also avoids GIL contention piling up under concurrent requests.
        now = time.monotonic()
        with _options_lock:
            hit = _sorted_options_cache.get(state)
            if hit is not None and now - hit[0] < _OPTIONS_TTL_S:
                return list(hit[1])

        markets_per_crop = {}
        for o in opts:
            markets_per_crop[o.crop] = markets_per_crop.get(o.crop, 0) + 1
        opts.sort(
            key=lambda o: (_staple_rank(o.crop), -markets_per_crop[o.crop], o.crop, o.market)
        )
        with _options_lock:
            _sorted_options_cache[state] = (now, opts)
    return opts


# Common, widely-traded crops surface first in the picker when we have no
# location to sort by. Everything else falls back to "reported in most markets".
_STAPLES = [
    "onion", "tomato", "potato", "wheat", "rice", "paddy(common)", "maize",
    "soyabean", "cotton", "groundnut", "bengal gram(gram)(whole)", "green chilli",
    "banana", "sugarcane", "turmeric", "arhar (tur/red gram)(whole)", "mustard",
]
_STAPLE_INDEX = {name: i for i, name in enumerate(_STAPLES)}


def _staple_rank(crop: str) -> int:
    return _STAPLE_INDEX.get(crop.strip().lower(), len(_STAPLES))


def _fetch_series(db: Session, crop: str, market: str, days: int) -> list[PriceCache]:
    since = date.today() - timedelta(days=days)

    def _query(ci: bool = False) -> list[PriceCache]:
        crop_c = PriceCache.crop.ilike(crop.strip()) if ci else PriceCache.crop == crop
        mkt_c = PriceCache.market.ilike(market.strip()) if ci else PriceCache.market == market
        stmt = (
            select(PriceCache)
            .where(crop_c, mkt_c, PriceCache.date >= since)
            .order_by(PriceCache.date.asc())
        )
        return list(db.execute(stmt).scalars().all())

    # exact match first (index-friendly, always hits in the picker-driven flow);
    # fall back to a case-insensitive match for deep links / alerts / hand-built
    # URLs where the casing may be slightly off.
    rows = _query() or _query(ci=True)
    # The live AGMARKNET feed only carries the latest day. If this series is
    # too thin for a trend / signal, lazily synthesise history anchored to the
    # real latest price (cheap, single series, persisted).
    if rows and len({r.date for r in rows}) < ingestion.BACKFILL_MIN_REAL_DAYS:
        try:
            if ingestion.backfill_series(db, crop, market):
                rows = _query()
        except Exception:  # noqa: BLE001 - backfill is best-effort  # nosec B110
            pass
    return rows


@router.get("/prices/trend", response_model=PriceTrendResponse)
def price_trend(
    crop: str,
    market: str,
    days: int = Query(30, ge=1, le=90),
    db: Session = Depends(get_db),
) -> PriceTrendResponse:
    rows = _fetch_series(db, crop, market, days)
    if not rows:
        raise HTTPException(status_code=404, detail="No price data for this crop/market")
    return PriceTrendResponse(
        crop=crop,
        market=market,
        district=rows[-1].district,
        as_of=rows[-1].date,
        points=[
            PricePoint(
                date=r.date,
                min_price=r.min_price,
                max_price=r.max_price,
                modal_price=r.modal_price,
                arrival_volume=r.arrival_volume,
            )
            for r in rows
        ],
    )


@router.get("/prices/nearby", response_model=list[NearestMarketComparison])
def nearby_markets(
    crop: str,
    district: str,
    max_distance_km: float = Query(200, gt=0, le=2000),
    limit: int = Query(8, ge=1, le=50),
    db: Session = Depends(get_db),
) -> list[NearestMarketComparison]:
    crop_c = PriceCache.crop == crop
    latest_date = db.execute(
        select(PriceCache.date).where(crop_c).order_by(PriceCache.date.desc()).limit(1)
    ).scalar_one_or_none()
    if latest_date is None:  # retry case-insensitively before giving up
        crop_c = PriceCache.crop.ilike(crop.strip())
        latest_date = db.execute(
            select(PriceCache.date).where(crop_c).order_by(PriceCache.date.desc()).limit(1)
        ).scalar_one_or_none()
    if latest_date is None:
        raise HTTPException(status_code=404, detail="No price data for this crop")

    stmt = select(PriceCache).where(crop_c, PriceCache.date == latest_date)
    rows = list(db.execute(stmt).scalars().all())

    results = [
        NearestMarketComparison(
            market=r.market,
            district=r.district,
            distance_km=district_distance_km(district, r.district),
            modal_price=r.modal_price,
            date=r.date,
        )
        for r in rows
    ]
    # If we can place the origin district, drop markets we can't measure or that
    # are beyond the cap (no more Chennai showing up for Coimbatore). If the
    # origin is unknown we can't filter by distance, so keep everything.
    if _district_coord(district) is not None:
        kept = [x for x in results if x.distance_km is not None and x.distance_km <= max_distance_km]
    else:
        kept = [x for x in results if x.distance_km is None or x.distance_km <= max_distance_km]
    kept.sort(key=lambda item: (item.distance_km is None, item.distance_km or 0.0))
    return kept[:limit]


def _forecast_for(db: Session, crop: str, market: str, horizon: int = 30) -> forecast_svc.Forecast:
    rows = _fetch_series(db, crop, market, days=120)
    return forecast_svc.forecast_prices([(r.date, r.modal_price) for r in rows], horizon)


@router.get("/prices/forecast", response_model=PriceForecastResponse)
def price_forecast(
    crop: str,
    market: str,
    horizon: int = Query(30, ge=3, le=45),
    db: Session = Depends(get_db),
) -> PriceForecastResponse:
    rows = _fetch_series(db, crop, market, days=120)
    series = [(r.date, r.modal_price) for r in rows]
    f = forecast_svc.forecast_prices(series, horizon)
    so = forecast_svc.second_opinion(series, horizon, primary=f)
    return PriceForecastResponse(
        available=f.available, crop=crop, market=market, method=f.method,
        horizon_days=f.horizon_days, last_price=f.last_price, trend_per_day=f.trend_per_day,
        weekly_pattern=f.weekly_pattern, change_pct_7d=f.change_pct_7d,
        change_pct_30d=f.change_pct_30d, note=f.note,
        points=[ForecastPointOut(date=p.date, yhat=p.yhat, lo=p.lo, hi=p.hi) for p in f.points],
        second_opinion=SecondOpinionOut(
            available=so.available, method=so.method, change_pct_7d=so.change_pct_7d,
            change_pct_30d=so.change_pct_30d, agrees_with_primary=so.agrees_with_primary,
            note=so.note,
        ),
    )


@router.get("/prices/signal", response_model=SellWaitSignalResponse)
def sell_wait_signal(
    crop: str,
    market: str,
    db: Session = Depends(get_db),
) -> SellWaitSignalResponse:
    rows = _fetch_series(db, crop, market, days=60)
    if len(rows) < 7:
        raise HTTPException(status_code=404, detail="Not enough price history to compute a signal")

    # v1.1 context: 7-day weather for the market + the crop's MSP.
    weather_ctx = None
    try:
        pt = market_coords(market) or (
            _district_coord(rows[-1].district or "") if rows else None
        )
        if pt is not None:
            weather_ctx = weather.get_forecast(*pt)
    except Exception:  # noqa: BLE001 - weather never blocks the signal
        weather_ctx = None
    msp_ctx = reference.msp_for(crop)
    forecast_ctx = _forecast_for(db, crop, market)

    signal = compute_signal(rows, weather=weather_ctx, msp=msp_ctx, forecast=forecast_ctx)
    if signal is None:
        raise HTTPException(status_code=404, detail="Not enough price history to compute a signal")
    return SellWaitSignalResponse(
        recommendation=signal.recommendation,
        reasons=signal.reasons,
        current_price=signal.current_price,
        ma_7=signal.ma_7,
        ma_30=signal.ma_30,
        volume_trend_pct=signal.volume_trend_pct,
        days_of_data=signal.days_of_data,
        weather_bias=signal.weather_bias,
        weather_note=signal.weather_note,
        msp=signal.msp,
        forecast_bias=signal.forecast_bias,
        forecast_note=signal.forecast_note,
        forecast_change_pct_7d=signal.forecast_change_pct_7d,
        total_score=signal.total_score,
        factors=signal.factors or [],
    )


@router.post("/ingest/run", response_model=IngestionResultResponse)
def trigger_ingestion(
    request: Request,
    x_ingest_secret: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> IngestionResultResponse:
    # D-05: the one write surface in an otherwise public phase. Constant-time
    # compare (ASVS V6); a blank configured secret keeps the endpoint disabled.
    # The 403 body is a fixed string and the secret is never logged.
    expected = settings.ingest_trigger_secret
    if not expected or not x_ingest_secret or not secrets.compare_digest(x_ingest_secret, expected):
        raise HTTPException(status_code=403, detail="Forbidden")
    # a full ingestion is heavy — a safety valve against an accidental retry loop
    # even for a caller holding the secret (legit use is one cron tick / interval).
    client_ip = request.client.host if request.client else "unknown"
    if not ratelimit.check(f"ingest_run:{client_ip}", limit=6, window_s=60):
        raise HTTPException(status_code=429, detail="Ingestion already running too often; slow down.")
    result = ingestion.run_ingestion(db)
    return IngestionResultResponse(**result)
