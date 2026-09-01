"""resolve_ingestion_rows() source-selection: the live path must degrade to the
committed snapshot (or the synthetic fixture) and never surface "live" when the
data.gov.in call fails or returns nothing. No DB is touched here.
"""

import httpx

from app.services import ingestion
from app.services.snapshot import load_snapshot_rows


def _raise_connect_error(_key):
    raise httpx.ConnectError("boom")


def test_falls_back_when_live_raises(monkeypatch):
    monkeypatch.setattr(ingestion.settings, "data_gov_in_api_key", "x")
    monkeypatch.setattr(ingestion, "fetch_maharashtra_rows", _raise_connect_error)

    source, rows = ingestion.resolve_ingestion_rows()

    assert source in {"snapshot", "fixture"}
    assert len(rows) > 0


def test_falls_back_when_live_empty(monkeypatch):
    monkeypatch.setattr(ingestion.settings, "data_gov_in_api_key", "x")
    monkeypatch.setattr(ingestion, "fetch_maharashtra_rows", lambda _key: [])

    source, rows = ingestion.resolve_ingestion_rows()

    assert source in {"snapshot", "fixture"}
    assert len(rows) > 0


def test_snapshot_rows_have_no_volume():
    rows = load_snapshot_rows()

    assert len(rows) > 0
    assert all(row["arrival_volume"] is None for row in rows)
