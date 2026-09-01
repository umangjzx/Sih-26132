"""Pulls Maharashtra mandi prices from the data.gov.in AGMARKNET resource
(9ef84268-d588-465a-a308-a864a43d0070), paginating until exhausted, and
upserts into PriceCache. Never called live on a user request — only from the
scheduled job in main.py's startup/interval trigger.

Source order (D-04, revised 2026-09-01): live API -> synthetic fixtures, with the
committed CSV snapshot used ahead of fixtures only when it is dense enough to
drive every dashboard view on its own (>= SNAPSHOT_MIN_SERIES_POINTS dated points
for some market+crop series). The bundled snapshot is a small authentic sample,
so in practice the offline path is fixtures — they carry 90 days across every
market+crop and are the only source with `arrival_volume`.

The OGD AGMARKNET price resource carries no arrival-volume field and there is
no companion arrivals feed, so `arrival_volume` is always None on live/snapshot
rows and the sell/wait signal's volume factor is powered only by the synthetic
fixture data (or, in a later phase, a non-OGD arrivals source wired through the
`fetch_arrivals_rows()` / `merge_arrivals()` seam — PRICE-07). `app.services.signal`
degrades its explanation when volume is absent.
"""

import logging
from datetime import date, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.price_cache import PriceCache
from app.services.fixtures import generate_fixture_rows
from app.services.snapshot import load_snapshot_rows

logger = logging.getLogger(__name__)

RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070"
BASE_URL = f"https://api.data.gov.in/resource/{RESOURCE_ID}"
PAGE_SIZE = 1000

# The snapshot is preferred over fixtures only if it can stand alone — i.e. it has
# at least one market+crop series with enough dated points for the 7-day signal
# window (app.services.signal.compute_signal needs >= 7).
SNAPSHOT_MIN_SERIES_POINTS = 7


def _parse_date(value: str) -> date | None:
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except (ValueError, TypeError):
            continue
    return None


def _parse_float(value: str | None) -> float | None:
    try:
        return float(value) if value not in (None, "", "NA") else None
    except ValueError:
        return None


def fetch_maharashtra_rows(api_key: str) -> list[dict]:
    """Pages through the live API. Raises on network/HTTP failure so the
    caller can fall back to fixtures."""
    rows: list[dict] = []
    offset = 0
    with httpx.Client(timeout=20.0) as client:
        while True:
            resp = client.get(
                BASE_URL,
                params={
                    "api-key": api_key,
                    "format": "json",
                    "offset": offset,
                    "limit": PAGE_SIZE,
                    "filters[state]": "Maharashtra",
                },
            )
            resp.raise_for_status()
            payload = resp.json()
            records = payload.get("records", [])
            if not records:
                break
            rows.extend(records)
            total = int(payload.get("total", len(rows)))
            offset += len(records)
            if offset >= total or len(records) < PAGE_SIZE:
                break
    return rows


def normalize_rows(raw_rows: list[dict]) -> list[dict]:
    normalized = []
    for raw in raw_rows:
        parsed_date = _parse_date(raw.get("arrival_date", ""))
        min_price = _parse_float(raw.get("min_price"))
        max_price = _parse_float(raw.get("max_price"))
        modal_price = _parse_float(raw.get("modal_price"))
        if not (raw.get("commodity") and raw.get("market") and parsed_date and modal_price):
            continue
        normalized.append(
            {
                "crop": raw["commodity"],
                "variety": raw.get("variety") or "",
                "market": raw["market"],
                "district": raw.get("district") or "",
                "state": raw.get("state") or "Maharashtra",
                "date": parsed_date,
                "min_price": min_price if min_price is not None else modal_price,
                "max_price": max_price if max_price is not None else modal_price,
                "modal_price": modal_price,
                "arrival_volume": None,
            }
        )
    return normalized


def upsert_price_rows(db: Session, rows: list[dict]) -> int:
    if not rows:
        return 0
    stmt = insert(PriceCache).values(rows)
    update_cols = {
        col: stmt.excluded[col]
        for col in ("state", "district", "min_price", "max_price", "modal_price", "arrival_volume")
    }
    stmt = stmt.on_conflict_do_update(
        index_elements=["market", "crop", "variety", "date"],
        set_=update_cols,
    )
    db.execute(stmt)
    db.commit()
    return len(rows)


def _densest_series_points(rows: list[dict]) -> int:
    """Largest number of dated points any single (market, crop) series has."""
    counts: dict[tuple, int] = {}
    for row in rows:
        key = (row.get("market"), row.get("crop"))
        counts[key] = counts.get(key, 0) + 1
    return max(counts.values(), default=0)


def resolve_ingestion_rows() -> tuple[str, list[dict]]:
    """Decide the price-row source and return the rows. Pure: no DB access, no
    side effects, never raises. Order is live -> (dense snapshot) -> synthetic
    fixture (D-04, revised):

      * "live"     — data.gov.in AGMARKNET resource (D-01), only when a key is
                     configured and the call yields usable normalized rows.
      * "snapshot" — the committed Maharashtra CSV export (authentic names/prices,
                     no arrival volume), used ahead of fixtures ONLY when it is
                     dense enough to stand alone (>= SNAPSHOT_MIN_SERIES_POINTS
                     dated points for some market+crop series).
      * "fixture"  — the synthetic generator: 90 days across every market+crop and
                     the only source with arrival_volume. This is the normal
                     offline path — the bundled snapshot is a small sample.
    """
    try:
        if not settings.data_gov_in_api_key:
            raise RuntimeError("DATA_GOV_IN_API_KEY not configured")
        rows = normalize_rows(fetch_maharashtra_rows(settings.data_gov_in_api_key))
        if not rows:
            raise RuntimeError("live API returned no usable rows")
        return "live", rows
    except Exception as exc:  # noqa: BLE001 - any failure falls back to snapshot/fixture
        logger.warning("Live ingestion unavailable (%s); using snapshot/fixture data", exc)

    snapshot_rows = load_snapshot_rows()
    if _densest_series_points(snapshot_rows) >= SNAPSHOT_MIN_SERIES_POINTS:
        return "snapshot", snapshot_rows
    if snapshot_rows:
        logger.info(
            "Snapshot present but too sparse (densest series < %d points); using fixtures",
            SNAPSHOT_MIN_SERIES_POINTS,
        )
    return "fixture", generate_fixture_rows()


def fetch_arrivals_rows() -> list[dict]:
    """Arrivals-volume seam — OFF by default in Phase 1.

    The OGD price resource has no arrivals data and no non-OGD arrivals source is
    wired yet, so with `ARRIVALS_SOURCE_URL` empty this returns `[]` (and says so
    once in the log). If a URL is somehow configured we fail loudly rather than
    silently doing nothing — the actual client is a later phase (PRICE-01/PRICE-07).
    """
    if not settings.arrivals_source_url:
        logger.warning(
            "No live arrivals source configured (ARRIVALS_SOURCE_URL empty) - "
            "volume factor runs on fixture/snapshot data only; see PRICE-07"
        )
        return []
    raise NotImplementedError(
        "ARRIVALS_SOURCE_URL is set but no arrivals client is implemented; wire a "
        "non-OGD arrivals source here for PRICE-01/PRICE-07"
    )


def merge_arrivals(price_rows: list[dict], arrival_rows: list[dict]) -> list[dict]:
    """D-03: join arrival volume onto existing price rows, keyed on
    (market, crop, date). Arrival rows that match nothing are dropped; no new
    row is ever appended to `price_rows`. Returns `price_rows` (mutated in place)."""
    index: dict[tuple, dict] = {
        (row.get("market"), row.get("crop"), row.get("date")): row for row in price_rows
    }
    for arrival in arrival_rows:
        key = (arrival.get("market"), arrival.get("crop"), arrival.get("date"))
        target = index.get(key)
        if target is not None:
            target["arrival_volume"] = arrival.get("arrival_volume")
    return price_rows


def run_ingestion(db: Session) -> dict:
    """Resolves the row source (live -> dense snapshot -> fixture) and upserts into
    PriceCache so the dashboard always has something to show. Then evaluates any
    standing price alerts against the fresh data (v1.1)."""
    source, rows = resolve_ingestion_rows()
    # Phase 1: dormant. Wire here when a non-OGD arrivals source lands (PRICE-07).
    count = upsert_price_rows(db, rows)

    alerts_fired = 0
    try:
        from app.services.alerts import evaluate_alerts

        alerts_fired = evaluate_alerts(db)
    except Exception as exc:  # noqa: BLE001 - alert evaluation never blocks ingestion
        logger.warning("Alert evaluation failed (%s)", exc)

    return {"source": source, "rows_upserted": count, "alerts_fired": alerts_fired}


def has_price_data(db: Session) -> bool:
    return db.execute(select(PriceCache.id).limit(1)).first() is not None
