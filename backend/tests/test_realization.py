"""Price-realisation tracker (v1.6 #1)."""

from datetime import date, timedelta

from app.models.deal import Deal
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.models.price_cache import PriceCache
from app.services.realization import farmer_realization


def _seed_prices(db, crop, modal, *, around=None, state="Maharashtra", n=15):
    around = around or date.today()
    for i in range(-n, n + 1):
        db.add(PriceCache(
            crop=crop, variety="Local", market="Pune", district="Pune", state=state,
            date=around + timedelta(days=i),
            min_price=modal - 50, max_price=modal + 50, modal_price=modal,
            arrival_volume=None,
        ))
    db.commit()


def _make_deal(db, farmer_id, *, crop, agreed_price, qty_kg, status="closed", days_ago=5):
    lot = Lot(
        farmer_id=farmer_id, crop=crop, quantity_kg=qty_kg, quality_grade="FAQ",
        expected_price=agreed_price, available_from=date.today(), location="Pune",
        status="matched",
    )
    demand = Demand(
        buyer_id=999, crop=crop, quantity_kg=qty_kg, quality_spec="clean",
        price_band_min=agreed_price - 100, price_band_max=agreed_price + 100,
        delivery_window="1 week", delivery_district="Pune", status="matched",
    )
    db.add_all([lot, demand])
    db.commit()
    match = Match(lot_id=lot.id, demand_id=demand.id, score=90, status="accepted")
    db.add(match)
    db.commit()
    deal = Deal(
        match_id=match.id, agreed_price=agreed_price, agreed_quantity=qty_kg,
        pipeline_status=status,
    )
    db.add(deal)
    db.commit()
    # backdate so the benchmark window lines up
    deal.created_at = date.today() - timedelta(days=days_ago)
    db.commit()
    return deal


def test_realization_computes_uplift_vs_mandi(db, farmer_user):
    _seed_prices(db, "Onion", modal=1800)
    _make_deal(db, farmer_user.id, crop="Onion", agreed_price=1980, qty_kg=2000)

    out = farmer_realization(db, farmer_user.id)
    assert out["summary"]["deals_completed"] == 1
    d = out["deals"][0]
    assert d["realized_per_qtl"] == 1980
    assert d["mandi_benchmark_per_qtl"] == 1800
    assert d["vs_mandi_pct"] == 10.0
    assert out["summary"]["uplift_vs_mandi_pct"] == 10.0
    assert out["summary"]["total_value_inr"] == round(1980 * 2000 / 100, 0)


def test_realization_volume_weights_multiple_deals(db, farmer_user):
    _seed_prices(db, "Tomato", modal=1000)
    # small deal at a big premium, large deal at a small premium
    _make_deal(db, farmer_user.id, crop="Tomato", agreed_price=1500, qty_kg=100, days_ago=3)
    _make_deal(db, farmer_user.id, crop="Tomato", agreed_price=1050, qty_kg=9900, days_ago=7)

    out = farmer_realization(db, farmer_user.id)
    # weighted realised ~ (1500*100 + 1050*9900) / 10000 = 1054.5 -> 1054 or 1055
    assert 1050 <= out["summary"]["weighted_realized_per_qtl"] <= 1060
    assert out["summary"]["uplift_vs_mandi_pct"] < 6  # not dragged up by the tiny lot


def test_realization_flags_below_msp(db, farmer_user):
    _seed_prices(db, "Soybean", modal=4600)          # mandi below MSP (4892)
    _make_deal(db, farmer_user.id, crop="Soybean", agreed_price=4700, qty_kg=1000)

    out = farmer_realization(db, farmer_user.id)
    d = out["deals"][0]
    assert d["msp_per_qtl"] == 4892
    assert d["vs_msp_pct"] < 0
    assert out["summary"]["below_msp_deals"] == 1


def test_realization_pending_deal_excluded_from_summary(db, farmer_user):
    _seed_prices(db, "Onion", modal=1800)
    _make_deal(db, farmer_user.id, crop="Onion", agreed_price=2000, qty_kg=500, status="matched")

    out = farmer_realization(db, farmer_user.id)
    assert out["summary"]["deals_total"] == 1
    assert out["summary"]["deals_completed"] == 0
    assert out["summary"]["uplift_vs_mandi_pct"] is None
    assert out["deals"][0]["completed"] is False


def test_realization_no_price_data_leaves_benchmark_none(db, farmer_user):
    _make_deal(db, farmer_user.id, crop="Dragonfruit", agreed_price=5000, qty_kg=300)
    out = farmer_realization(db, farmer_user.id)
    d = out["deals"][0]
    assert d["mandi_benchmark_per_qtl"] is None
    assert d["vs_mandi_pct"] is None


def test_realization_matches_crop_case_insensitively(db, farmer_user):
    # AGMARKNET stores "Onion"; the farmer typed the lot crop lowercase
    _seed_prices(db, "Onion", modal=1800)
    _make_deal(db, farmer_user.id, crop="onion", agreed_price=1980, qty_kg=1000)

    out = farmer_realization(db, farmer_user.id)
    d = out["deals"][0]
    assert d["mandi_benchmark_per_qtl"] == 1800
    assert d["vs_mandi_pct"] == 10.0


def test_realization_endpoint_farmer(farmer_client, db, farmer_user):
    _seed_prices(db, "Onion", modal=1800)
    _make_deal(db, farmer_user.id, crop="Onion", agreed_price=1980, qty_kg=1000)
    resp = farmer_client.get("/api/history/realization")
    assert resp.status_code == 200
    assert resp.json()["summary"]["uplift_vs_mandi_pct"] == 10.0


def test_realization_endpoint_farmer_cannot_inspect_others(farmer_client):
    resp = farmer_client.get("/api/history/realization", params={"farmer_id": 4242})
    assert resp.status_code == 403
