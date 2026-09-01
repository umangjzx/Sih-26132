"""Reads the committed Maharashtra data.gov.in price export
(`data/maharashtra_snapshot.csv`) into the same row shape `ingestion.normalize_rows`
produces. This is the middle tier of `resolve_ingestion_rows()`'s source order
(live -> snapshot -> synthetic fixture): it gives the demo authentic market names
and prices when the live data.gov.in API is unavailable.

The export carries the resource's 10-field schema
(`state,district,market,commodity,variety,grade,arrival_date,min_price,max_price,modal_price`)
and has no arrivals column, so `arrival_volume` is always None on snapshot rows —
the sell/wait signal's volume factor degrades gracefully, exactly as with live data.

Stdlib `csv` only (no dataframe library) per 1-RESEARCH.md "Don't Hand-Roll".
"""

import csv
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_DEFAULT_PATH = Path(__file__).resolve().parent / "data" / "maharashtra_snapshot.csv"


def load_snapshot_rows(path: str | None = None) -> list[dict]:
    """Parse the committed CSV snapshot into normalized row dicts.

    Output shape matches `ingestion.normalize_rows`: `crop`, `variety`, `market`,
    `district`, `state`, `date` (a `datetime.date`), `min_price`, `max_price`,
    `modal_price`, and `arrival_volume=None` on every row. Rows missing
    commodity / market / a parseable date / modal_price are skipped, mirroring
    `normalize_rows`.
    """
    # Local import avoids an import cycle (ingestion imports load_snapshot_rows).
    from app.services.ingestion import _parse_date, _parse_float

    csv_path = Path(path) if path else _DEFAULT_PATH
    if not csv_path.exists():
        logger.warning("Snapshot CSV not found at %s", csv_path)
        return []

    rows: list[dict] = []
    with csv_path.open(newline="", encoding="utf-8") as handle:
        for raw in csv.DictReader(handle):
            parsed_date = _parse_date((raw.get("arrival_date") or "").strip())
            min_price = _parse_float(raw.get("min_price"))
            max_price = _parse_float(raw.get("max_price"))
            modal_price = _parse_float(raw.get("modal_price"))
            commodity = (raw.get("commodity") or "").strip()
            market = (raw.get("market") or "").strip()
            if not (commodity and market and parsed_date and modal_price):
                continue
            rows.append(
                {
                    "crop": commodity,
                    "variety": (raw.get("variety") or "").strip(),
                    "market": market,
                    "district": (raw.get("district") or "").strip(),
                    "state": (raw.get("state") or "Maharashtra").strip() or "Maharashtra",
                    "date": parsed_date,
                    "min_price": min_price if min_price is not None else modal_price,
                    "max_price": max_price if max_price is not None else modal_price,
                    "modal_price": modal_price,
                    "arrival_volume": None,
                }
            )
    return rows
