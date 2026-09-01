"""Pulls Maharashtra mandi prices from the data.gov.in AGMARKNET resource
(9ef84268-d588-465a-a308-a864a43d0070), paginating until exhausted, and
upserts into PriceCache. Never called live on a user request — only from the
scheduled job in main.py's startup/interval trigger.

The source dataset has no arrival-volume field, so arrival_volume is always
None on ingested rows; app.services.signal degrades its explanation when
volume is absent.
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

logger = logging.getLogger(__name__)

RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070"
BASE_URL = f"https://api.data.gov.in/resource/{RESOURCE_ID}"
PAGE_SIZE = 1000


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


def run_ingestion(db: Session) -> dict:
    """Tries the live API first (if a key is configured); falls back to the
    bundled fixture dataset when the key is missing, the call fails, or the
    table is still empty so the app has something to show either way."""
    source = "live"
    try:
        if not settings.data_gov_in_api_key:
            raise RuntimeError("DATA_GOV_IN_API_KEY not configured")
        raw_rows = fetch_maharashtra_rows(settings.data_gov_in_api_key)
        rows = normalize_rows(raw_rows)
        if not rows:
            raise RuntimeError("live API returned no usable rows")
    except Exception as exc:  # noqa: BLE001 - any failure falls back to fixtures
        logger.warning("Live ingestion unavailable (%s); using fixture data", exc)
        source = "fixture"
        rows = generate_fixture_rows()

    count = upsert_price_rows(db, rows)
    return {"source": source, "rows_upserted": count}


def has_price_data(db: Session) -> bool:
    return db.execute(select(PriceCache.id).limit(1)).first() is not None
