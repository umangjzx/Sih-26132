"""Negotiation-context endpoint (v1.6 #2) — decision support for a counter-offer."""

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.models.price_cache import PriceCache
from app.services.matching import run_matching


def _seed_match(db, farmer_user, buyer_user, crop="Onion"):
    lot = Lot(
        farmer_id=farmer_user.id, crop=crop, quantity_kg=500, quality_grade="A",
        expected_price=2400, available_from=date(2026, 10, 1), location="Pune", status="open",
    )
    demand = Demand(
        buyer_id=buyer_user.id, crop=crop, quantity_kg=600, quality_spec="Grade A",
        price_band_min=2000, price_band_max=2800, delivery_window="7 days", status="open",
    )
    db.add_all([lot, demand])
    db.commit()
    run_matching(db)
    return db.execute(select(Match)).scalar_one()


def _client(db):
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def test_negotiation_context_without_offers_uses_band_midpoint(db, farmer_user, buyer_user):
    m = _seed_match(db, farmer_user, buyer_user)
    db.add(PriceCache(
        crop="Onion", variety="Local", market="Pune", district="Pune", state="Maharashtra",
        date=date.today(), min_price=1900, max_price=2100, modal_price=2000, arrival_volume=None,
    ))
    db.commit()
    c = _client(db)
    app.dependency_overrides[get_current_user] = lambda: farmer_user
    try:
        r = c.get(f"/api/matches/{m.id}/negotiation")
        assert r.status_code == 200
        body = r.json()
        assert body["you_are"] == "farmer"
        assert body["farmer_last_offer"] is None and body["buyer_last_offer"] is None
        assert body["spread_per_qtl"] is None
        # midpoint = mean(lot expected 2400, band mid 2400) = 2400
        assert body["suggested_midpoint_per_qtl"] == 2400
        assert body["references"]["mandi_modal_per_qtl"] == 2000
        assert body["references"]["msp_per_qtl"] is None  # Onion has no MSP
    finally:
        app.dependency_overrides.clear()


def test_negotiation_context_computes_spread_and_midpoint(db, farmer_user, buyer_user):
    m = _seed_match(db, farmer_user, buyer_user)
    c = _client(db)
    # farmer asks 2600
    app.dependency_overrides[get_current_user] = lambda: farmer_user
    c.post(f"/api/matches/{m.id}/offers", json={"price": 2600, "quantity": 500})
    # buyer counters 2400
    app.dependency_overrides[get_current_user] = lambda: buyer_user
    c.post(f"/api/matches/{m.id}/offers", json={"price": 2400, "quantity": 500})
    try:
        r = c.get(f"/api/matches/{m.id}/negotiation")
        body = r.json()
        assert body["farmer_last_offer"]["price"] == 2600
        assert body["buyer_last_offer"]["price"] == 2400
        assert body["spread_per_qtl"] == 200
        assert body["suggested_midpoint_per_qtl"] == 2500
        assert body["pending_offer"]["price"] == 2400
        assert body["pending_offer"]["from_you"] is True  # buyer is current user
    finally:
        app.dependency_overrides.clear()


def test_negotiation_context_access_denied_for_stranger(db, farmer_user, buyer_user, admin_user):
    m = _seed_match(db, farmer_user, buyer_user)
    c = _client(db)
    app.dependency_overrides[get_current_user] = lambda: admin_user  # not a party
    try:
        r = c.get(f"/api/matches/{m.id}/negotiation")
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_negotiation_context_mandi_falls_back_to_all_india(db, farmer_user, buyer_user):
    m = _seed_match(db, farmer_user, buyer_user, crop="Tur")
    db.add(PriceCache(
        crop="Tur", variety="FAQ", market="Akola", district="Akola", state="Maharashtra",
        date=date.today(), min_price=7000, max_price=7400, modal_price=7200, arrival_volume=None,
    ))
    db.commit()
    c = _client(db)
    app.dependency_overrides[get_current_user] = lambda: buyer_user
    try:
        body = c.get(f"/api/matches/{m.id}/negotiation").json()
        assert body["references"]["mandi_modal_per_qtl"] == 7200
        assert body["references"]["mandi_basis"] == "all-India"  # no Pune-district Tur row
        assert body["references"]["msp_per_qtl"] == 7550  # Tur has an MSP
    finally:
        app.dependency_overrides.clear()
