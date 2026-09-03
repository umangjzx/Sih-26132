"""Pulls all-India mandi prices from the data.gov.in AGMARKNET resource
`9ef84268-d588-465a-a308-a864a43d0070` ("Current Daily Price of Various
Commodities from Various Markets (Mandi)"), paginating until exhausted, and
upserts into PriceCache. Never called live on a user request — only from
main.py's boot + 6-hourly scheduler.

Source order (D-04): live API -> committed CSV snapshot (only when dense enough
to stand alone) -> synthetic fixtures. `INGEST_STATES=ALL` (default) pulls the
whole national feed in one shot (~10k rows / 25 states / ~7s).

Known resource limits:
  * data.gov.in stalls forever on python-httpx's default User-Agent — we send a
    real UA (see fetch_agmarknet_rows).
  * It exposes only the LATEST day (arrival_date == today); history accumulates
    as this job runs day after day. `backfill_series()` synthesises the gap for
    a just-viewed series, anchored to the real latest modal price.
  * No arrival-volume field and no companion arrivals feed, so `arrival_volume`
    is always None on live rows and the sell/wait signal's volume factor is
    powered only by synthetic fixture data (or a future non-OGD source via the
    `fetch_arrivals_rows()` / `merge_arrivals()` seam — PRICE-07).
  * State spellings vary (Keralam, Orissa, "Andaman and Nicobar") — canonicalised
    in `normalize_rows`. The feed also carries several rows per
    (market, crop, variety, date); `upsert_price_rows` dedupes.
"""

import hashlib
import logging
import random
from datetime import date, datetime, timedelta

import httpx
from sqlalchemy import func, select
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
# hard ceiling for the unbounded scheduled pull — the national feed is ~10-15
# pages; this only trips on a malformed `total` that would otherwise loop.
_MAX_PAGES_HARD = 60

# The historical archive of the same AGMARKNET feed (~81M rows, back to ~2023).
# Same shape, capitalised field names. Used to backfill real trend history for a
# single market+commodity on demand instead of synthesising it.
HISTORY_RESOURCE_ID = "35985678-0d79-46b4-9ed6-6f13308a1d24"
HISTORY_URL = f"https://api.data.gov.in/resource/{HISTORY_RESOURCE_ID}"
_DGV_HEADERS = {"User-Agent": "AgriLink/1.0 (SIH 2026; +https://data.gov.in)"}

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
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip().replace(",", "")  # AGMARKNET occasionally sends "1,200"
        if value in ("", "NA", "-"):
            return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _fetch_state(
    client: httpx.Client, api_key: str, state: str | None, max_pages: int | None = None
) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    pages = 0
    while True:
        params = {
            "api-key": api_key,
            "format": "json",
            "offset": offset,
            "limit": PAGE_SIZE,
        }
        if state:
            params["filters[state]"] = state
        try:
            resp = client.get(BASE_URL, params=params)
            resp.raise_for_status()
            payload = resp.json()
        except Exception as exc:  # noqa: BLE001
            # A slow/failed page shouldn't sink the whole pull — keep what we
            # have (partial national data still covers most states).
            if rows:
                logger.warning("AGMARKNET page at offset %d failed (%s); using %d rows so far",
                               offset, exc, len(rows))
                break
            raise
        records = payload.get("records", [])
        if not records:
            break
        rows.extend(records)
        total = int(payload.get("total", len(rows)))
        offset += len(records)
        pages += 1
        if offset >= total or len(records) < PAGE_SIZE:
            break
        if max_pages is not None and pages >= max_pages:
            break
        if pages >= _MAX_PAGES_HARD:
            logger.warning("AGMARKNET pull hit the %d-page hard ceiling at offset %d "
                           "(total reported: %s)", _MAX_PAGES_HARD, offset, total)
            break
    return rows


def fetch_agmarknet_rows(
    api_key: str,
    states: list[str] | None = None,
    *,
    timeout: float = 30.0,
    max_pages: int | None = None,
) -> list[dict]:
    """Pages through the live AGMARKNET feed for the given states (or the whole
    of India when ``states`` is None). Raises on network/HTTP failure so the
    caller can fall back to snapshot/fixtures.

    ``timeout`` / ``max_pages`` bound the work for the on-demand per-state pull
    (the upstream API is slow); the scheduled job uses the generous defaults.
    """
    rows: list[dict] = []
    limits = httpx.Timeout(timeout, connect=10.0, read=timeout)
    # data.gov.in stalls indefinitely on the default python-httpx User-Agent
    # (bot filtering); any real UA gets a normal ~1s response.
    with httpx.Client(timeout=limits, headers=_DGV_HEADERS) as client:
        if not states:
            rows.extend(_fetch_state(client, api_key, None, max_pages))
        else:
            for state in states:
                rows.extend(_fetch_state(client, api_key, state, max_pages))
    return rows


def fetch_maharashtra_rows(api_key: str) -> list[dict]:
    """Back-compat shim — Maharashtra-only pull."""
    return fetch_agmarknet_rows(api_key, ["Maharashtra"])


# data.gov.in AGMARKNET uses a few state spellings that differ from our canonical
# STATE_CENTROIDS keys (used for scoping + the /states list).
_STATE_ALIASES = {
    "keralam": "Kerala",
    "orissa": "Odisha",
    "chattisgarh": "Chhattisgarh",
    "uttaranchal": "Uttarakhand",
    "pondicherry": "Puducherry",
    "andaman and nicobar": "Andaman and Nicobar Islands",
    "nct of delhi": "Delhi",
    "jammu & kashmir": "Jammu and Kashmir",
    "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
    "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
}


def _canon_state(name: str | None) -> str:
    n = (name or "").strip()
    return _STATE_ALIASES.get(n.lower(), n) or "Maharashtra"


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
                "state": _canon_state(raw.get("state")),
                "date": parsed_date,
                "min_price": min_price if min_price is not None else modal_price,
                "max_price": max_price if max_price is not None else modal_price,
                "modal_price": modal_price,
                "arrival_volume": None,
            }
        )
    return normalized


def fetch_history(
    api_key: str, state: str, commodity: str, market: str, *,
    days: int = 120, timeout: float = 12.0,
) -> list[dict]:
    """Real daily history for one (state, commodity, market) series from the
    AGMARKNET archive resource, newest first. Normalised rows (may be empty).
    Never raises — a failure just means "no archive history for this series".
    """
    if not api_key:
        return []
    try:
        with httpx.Client(timeout=timeout, headers=_DGV_HEADERS) as client:
            resp = client.get(
                HISTORY_URL,
                params={
                    "api-key": api_key, "format": "json",
                    "offset": 0, "limit": max(100, min(days + 20, 400)),
                    "filters[State]": state,
                    "filters[Commodity]": commodity,
                    "filters[Market]": market,
                    "sort[Arrival_Date]": "desc",
                },
            )
            resp.raise_for_status()
            records = resp.json().get("records", []) or []
    except Exception as exc:  # noqa: BLE001
        logger.info("Archive history lookup failed for %s/%s/%s (%s)",
                    state, commodity, market, exc)
        return []
    # archive fields are Capitalised; normalize_rows expects lower_snake
    lowered = [{k.lower(): v for k, v in rec.items()} for rec in records]
    return normalize_rows(lowered)


def upsert_price_rows(db: Session, rows: list[dict]) -> int:
    if not rows:
        return 0
    # The national feed carries several entries per market+commodity+variety+day
    # (grades, revisions). Postgres ON CONFLICT rejects a batch that hits the
    # same conflict target twice, so collapse to one row per key (last wins).
    deduped: dict[tuple, dict] = {}
    for r in rows:
        deduped[(r["market"], r["crop"], r["variety"], r["date"])] = r
    rows = list(deduped.values())

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


def resolve_ingestion_rows(states: list[str] | None = "__default__") -> tuple[str, list[dict]]:
    """Decide the price-row source and return the rows. Pure: no DB access, no
    side effects, never raises. Order is live -> (dense snapshot) -> synthetic
    fixture (D-04, revised):

    ``states`` selects which AGMARKNET states the live pull covers:
      * "__default__" (sentinel) -> settings.ingest_state_list (Maharashtra unless
        overridden; None there means the whole national feed)
      * an explicit list -> just those states
      * None -> whole national feed

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
    if states == "__default__":
        states = settings.ingest_state_list
    try:
        if not settings.data_gov_in_api_key:
            raise RuntimeError("DATA_GOV_IN_API_KEY not configured")
        rows = normalize_rows(fetch_agmarknet_rows(settings.data_gov_in_api_key, states))
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


BACKFILL_DAYS = 90
BACKFILL_MIN_REAL_DAYS = 14


def backfill_series(db: Session, crop: str, market: str, *,
                    days: int = BACKFILL_DAYS,
                    min_real_days: int = BACKFILL_MIN_REAL_DAYS) -> int:
    """Lazy per-series history.

    The live AGMARKNET resource only exposes the latest day, so a fresh pull has
    no history for trend charts / the sell-wait signal. Called on demand by the
    price endpoints: if this crop+market has fewer than ``min_real_days`` dated
    points, first pull REAL history for it from the AGMARKNET archive resource;
    only fall back to a deterministic random walk (anchored to the real latest
    modal price) for the days the archive doesn't cover.

    Bounded to a single series, so it is cheap enough to run per request.
    Returns the number of rows inserted (0 if none needed).
    """
    today = date.today()
    cutoff = today - timedelta(days=days)

    existing = db.execute(
        select(PriceCache.variety, PriceCache.district, PriceCache.state,
               PriceCache.date, PriceCache.modal_price)
        .where(PriceCache.crop == crop, PriceCache.market == market,
               PriceCache.date >= cutoff)
        .order_by(PriceCache.date)
    ).all()
    if not existing:
        return 0
    n_days = len({r.date for r in existing})
    if n_days >= min_real_days:
        return 0

    earliest = existing[0]
    variety, district, state = earliest.variety, earliest.district, earliest.state
    anchor = float(earliest.modal_price or 0)
    if anchor <= 0:
        return 0

    inserted = 0

    # 1) Real archive history for this exact series.
    archive = [
        r for r in fetch_history(settings.data_gov_in_api_key, state, crop, market, days=days)
        if r["date"] >= cutoff
    ]
    if archive:
        inserted += upsert_price_rows(db, archive)
        have = {r["date"] for r in archive} | {r.date for r in existing}
        earliest_have = min(have)
        anchor_row = min(archive, key=lambda r: r["date"])
        anchor = float(anchor_row["modal_price"]) or anchor
    else:
        earliest_have = earliest.date
    if len(existing) + inserted and (earliest_have - cutoff).days <= 1:
        return inserted

    span = (earliest_have - cutoff).days
    if span <= 1:
        return inserted

    seed = int(hashlib.md5(f"{state}|{market}|{crop}|{variety}".encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    price = anchor
    new_rows: list[dict] = []
    for i in range(1, span + 1):  # walk BACKWARDS from the earliest real/archive point
        day = earliest_have - timedelta(days=i)
        price = max(anchor * 0.55, min(anchor * 1.7, price * (1 + rng.uniform(-0.02, 0.02))))
        spread = price * rng.uniform(0.04, 0.09)
        new_rows.append({
            "crop": crop, "variety": variety, "market": market,
            "district": district, "state": state, "date": day,
            "min_price": round(price - spread / 2, 2),
            "max_price": round(price + spread / 2, 2),
            "modal_price": round(price, 2),
            "arrival_volume": None,
        })
    return inserted + (upsert_price_rows(db, new_rows) if new_rows else 0)


def run_ingestion(db: Session, states: list[str] | None = "__default__") -> dict:
    """Resolves the row source (live -> dense snapshot -> fixture) and upserts into
    PriceCache so the dashboard always has something to show. Then backfills
    history for thin series and evaluates standing price alerts.

    ``states`` is passed through to ``resolve_ingestion_rows`` (v1.2)."""
    source, rows = resolve_ingestion_rows(states)
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
