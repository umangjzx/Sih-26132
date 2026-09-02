import secrets
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.price_cache import PriceCache
from app.schemas.price import (
    CropMarketOption,
    IngestionResultResponse,
    NearestMarketComparison,
    PricePoint,
    PriceTrendResponse,
    SellWaitSignalResponse,
)
from app.services import ingestion, reference, weather
from app.services.geo import _district_coord, district_distance_km
from app.services.market_towns import market_coords
from app.services.signal import compute_signal

router = APIRouter(prefix="/api", tags=["prices"])


@router.get("/options", response_model=list[CropMarketOption])
def list_options(
    state: str | None = None,
    db: Session = Depends(get_db),
) -> list[CropMarketOption]:
    stmt = select(
        PriceCache.crop, PriceCache.market, PriceCache.district, PriceCache.state
    ).distinct()
    if state:
        stmt = stmt.where(PriceCache.state == state)
    rows = db.execute(stmt).all()
    return [
        CropMarketOption(crop=r.crop, market=r.market, district=r.district, state=r.state or "")
        for r in rows
    ]


def _fetch_series(db: Session, crop: str, market: str, days: int) -> list[PriceCache]:
    since = date.today() - timedelta(days=days)

    def _query() -> list[PriceCache]:
        stmt = (
            select(PriceCache)
            .where(PriceCache.crop == crop, PriceCache.market == market, PriceCache.date >= since)
            .order_by(PriceCache.date.asc())
        )
        return list(db.execute(stmt).scalars().all())

    rows = _query()
    # The live AGMARKNET feed only carries the latest day. If this series is
    # too thin for a trend / signal, lazily synthesise history anchored to the
    # real latest price (cheap, single series, persisted).
    if rows and len({r.date for r in rows}) < ingestion.BACKFILL_MIN_REAL_DAYS:
        try:
            if ingestion.backfill_series(db, crop, market):
                rows = _query()
        except Exception:  # noqa: BLE001 - backfill is best-effort
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
    latest_date_stmt = select(PriceCache.date).where(PriceCache.crop == crop).order_by(PriceCache.date.desc()).limit(1)
    latest_date = db.execute(latest_date_stmt).scalar_one_or_none()
    if latest_date is None:
        raise HTTPException(status_code=404, detail="No price data for this crop")

    stmt = select(PriceCache).where(PriceCache.crop == crop, PriceCache.date == latest_date)
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
        pt = market_coords(market) or None
        if pt is not None:
            weather_ctx = weather.get_forecast(*pt)
    except Exception:  # noqa: BLE001 - weather never blocks the signal
        weather_ctx = None
    msp_ctx = reference.msp_for(crop)

    signal = compute_signal(rows, weather=weather_ctx, msp=msp_ctx)
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
    )


@router.post("/ingest/run", response_model=IngestionResultResponse)
def trigger_ingestion(
    x_ingest_secret: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> IngestionResultResponse:
    # D-05: the one write surface in an otherwise public phase. Constant-time
    # compare (ASVS V6); a blank configured secret keeps the endpoint disabled.
    # The 403 body is a fixed string and the secret is never logged.
    expected = settings.ingest_trigger_secret
    if not expected or not x_ingest_secret or not secrets.compare_digest(x_ingest_secret, expected):
        raise HTTPException(status_code=403, detail="Forbidden")
    result = ingestion.run_ingestion(db)
    return IngestionResultResponse(**result)
