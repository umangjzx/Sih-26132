"""resolve_ingestion_rows() source-selection: the live path must degrade to the
synthetic fixture (or a dense committed snapshot) and never surface "live" when
the data.gov.in call fails or returns nothing. Per revised D-04 the snapshot is
used ahead of fixtures only when it is dense enough to stand alone. No DB is
touched here.
"""

import httpx

from app.services import ingestion
from app.services.snapshot import load_snapshot_rows


def _raise_connect_error(*_args, **_kwargs):
    raise httpx.ConnectError("boom")


def _dated_series(market, crop, n):
    return [
        {"market": market, "crop": crop, "variety": "", "district": "D", "state": "Maharashtra",
         "date": f"2026-08-{day:02d}", "min_price": 1.0, "max_price": 2.0, "modal_price": 1.5,
         "arrival_volume": None}
        for day in range(1, n + 1)
    ]


def test_falls_back_when_live_raises(monkeypatch):
    monkeypatch.setattr(ingestion.settings, "data_gov_in_api_key", "x")
    monkeypatch.setattr(ingestion, "fetch_agmarknet_rows", _raise_connect_error)

    source, rows = ingestion.resolve_ingestion_rows()

    assert source in {"snapshot", "fixture"}
    assert len(rows) > 0


def test_falls_back_when_live_empty(monkeypatch):
    monkeypatch.setattr(ingestion.settings, "data_gov_in_api_key", "x")
    monkeypatch.setattr(ingestion, "fetch_agmarknet_rows", lambda *a, **k: [])

    source, rows = ingestion.resolve_ingestion_rows()

    assert source in {"snapshot", "fixture"}
    assert len(rows) > 0


def test_snapshot_rows_have_no_volume():
    rows = load_snapshot_rows()

    assert len(rows) > 0
    assert all(row["arrival_volume"] is None for row in rows)


def test_sparse_snapshot_yields_fixture(monkeypatch):
    """A snapshot with no series reaching the signal window falls through to fixtures."""
    monkeypatch.setattr(ingestion.settings, "data_gov_in_api_key", "")
    monkeypatch.setattr(ingestion, "load_snapshot_rows", lambda: _dated_series("Pune", "Onion", 3))

    source, rows = ingestion.resolve_ingestion_rows()

    assert source == "fixture"
    assert len(rows) > 0


def test_dense_snapshot_wins_over_fixture(monkeypatch):
    """A snapshot with a series >= SNAPSHOT_MIN_SERIES_POINTS is used as-is."""
    monkeypatch.setattr(ingestion.settings, "data_gov_in_api_key", "")
    dense = _dated_series("Pune", "Onion", ingestion.SNAPSHOT_MIN_SERIES_POINTS)
    monkeypatch.setattr(ingestion, "load_snapshot_rows", lambda: dense)

    source, rows = ingestion.resolve_ingestion_rows()

    assert source == "snapshot"
    assert rows == dense
