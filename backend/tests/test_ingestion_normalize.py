"""normalize_rows() row hygiene + the merge_arrivals() (market, crop, date) join."""

from datetime import date

from app.services.ingestion import merge_arrivals, normalize_rows


def _raw(**overrides):
    row = {
        "commodity": "Onion",
        "variety": "Local",
        "market": "Pune",
        "district": "Pune",
        "state": "Maharashtra",
        "arrival_date": "15/08/2026",
        "min_price": "1200",
        "max_price": "1800",
        "modal_price": "1500",
    }
    row.update(overrides)
    return row


def test_drops_rows_missing_required_fields():
    raw_rows = [
        _raw(commodity=""),
        _raw(market=""),
        _raw(arrival_date=""),
        _raw(modal_price=""),
        _raw(),  # the only complete row
    ]
    out = normalize_rows(raw_rows)
    assert len(out) == 1
    assert out[0]["crop"] == "Onion" and out[0]["market"] == "Pune"


def test_parses_both_date_formats():
    out = normalize_rows([_raw(arrival_date="15/08/2026"), _raw(arrival_date="2026-08-16")])
    assert [r["date"] for r in out] == [date(2026, 8, 15), date(2026, 8, 16)]


def test_arrival_volume_always_none():
    out = normalize_rows([_raw(), _raw(market="Nashik"), _raw(market="Solapur")])
    assert out and all(r["arrival_volume"] is None for r in out)


def test_parses_comma_and_whitespace_prices():
    out = normalize_rows([_raw(min_price=" 1,200 ", max_price="1,800", modal_price="1,500")])
    assert len(out) == 1
    assert out[0]["min_price"] == 1200.0
    assert out[0]["max_price"] == 1800.0
    assert out[0]["modal_price"] == 1500.0


def test_dash_price_is_treated_as_missing():
    # modal '-' means no usable price -> row dropped
    assert normalize_rows([_raw(modal_price="-")]) == []


def test_merge_arrivals_fills_matching_row():
    price_rows = [
        {"market": "Pune", "crop": "Onion", "date": date(2026, 8, 15), "arrival_volume": None},
    ]
    arrival_rows = [
        {"market": "Pune", "crop": "Onion", "date": date(2026, 8, 15), "arrival_volume": 42.0},
    ]
    out = merge_arrivals(price_rows, arrival_rows)
    assert len(out) == 1 and out[0]["arrival_volume"] == 42.0


def test_merge_arrivals_drops_unmatched():
    price_rows = [
        {"market": "Pune", "crop": "Onion", "date": date(2026, 8, 15), "arrival_volume": None},
    ]
    arrival_rows = [
        {"market": "Nagpur", "crop": "Tur", "date": date(2026, 8, 15), "arrival_volume": 99.0},
    ]
    out = merge_arrivals(price_rows, arrival_rows)
    assert len(out) == 1 and out[0]["arrival_volume"] is None
