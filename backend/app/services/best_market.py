"""Rank every market that trades a crop by the price a farmer would actually
net after paying to truck the produce there.

net_price_per_qtl = modal_price - (road_km * transport_rate_per_qtl_km)

Road distance comes from OSRM (``routing.road_distance``) with a haversine
fallback; each market's coordinates come from ``market_towns`` / district
centroids.
"""

import logging
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.price_cache import PriceCache
from app.services.freight import freight_rate
from app.services.geo import _district_coord
from app.services.market_towns import market_coords
from app.services.routing import road_distance

logger = logging.getLogger(__name__)


def _coords_for(market: str, district: str) -> tuple[float, float] | None:
    # all-India district table (~470 HQ coords), not the 36-entry Maharashtra
    # centroid set — otherwise every non-MH market is silently dropped and the
    # "best market" ranking 404s outside Maharashtra.
    return market_coords(market) or _district_coord(district)


def best_markets(
    db: Session,
    crop: str,
    origin: tuple[float, float],
    *,
    limit: int = 10,
    max_km: float = 400.0,
    use_routing: bool = True,
    origin_state: str | None = None,
) -> list[dict]:
    """Latest modal price per market for ``crop``, minus a diesel-indexed
    transport cost from ``origin``, ranked by net price descending.
    """
    latest_date = db.execute(
        select(PriceCache.date)
        .where(PriceCache.crop == crop)
        .order_by(PriceCache.date.desc())
        .limit(1)
    ).scalar_one_or_none()
    if latest_date is None:
        return []

    rows = db.execute(
        select(PriceCache.market, PriceCache.district, PriceCache.modal_price)
        .where(PriceCache.crop == crop, PriceCache.date == latest_date)
    ).all()

    rate = freight_rate(origin_state)["rate_per_qtl_km"]

    candidates: list[tuple[str, str, float, tuple[float, float]]] = []
    seen: set[str] = set()
    for market, district, modal in rows:
        if market in seen:
            continue
        seen.add(market)
        coords = _coords_for(market, district or "")
        if coords is None:
            continue
        candidates.append((market, district, modal, coords))

    # Each candidate's road distance is an independent, blocking HTTP call to
    # OSRM (8s timeout) — routing them one at a time used to serialize
    # dozens of these on a single request thread, worst-casing at minutes.
    # They share nothing but the read-only `origin`, so a small thread pool
    # runs them concurrently without changing which markets get routed or
    # how each one is scored.
    if use_routing and candidates:
        with ThreadPoolExecutor(max_workers=min(8, len(candidates))) as pool:
            routed = list(pool.map(lambda c: road_distance(origin, c[3]), candidates))
    elif candidates:
        from app.services.geo import haversine_km

        routed = [
            {"distance_km": round(haversine_km(origin, c[3]), 1), "duration_min": None, "source": "haversine"}
            for c in candidates
        ]
    else:
        routed = []

    out: list[dict] = []
    for (market, district, modal, _coords), r in zip(candidates, routed):
        km, mins, dsrc = r["distance_km"], r["duration_min"], r["source"]
        if km > max_km:
            continue
        transport = round(km * rate, 0)
        out.append(
            {
                "market": market,
                "district": district,
                "modal_price": round(float(modal), 0),
                "road_km": km,
                "drive_min": mins,
                "transport_cost_per_qtl": transport,
                "net_price_per_qtl": round(float(modal) - transport, 0),
                "distance_source": dsrc,
                "date": latest_date.isoformat(),
            }
        )

    out.sort(key=lambda x: x["net_price_per_qtl"], reverse=True)
    return out[:limit]
