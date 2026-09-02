"""v1.4 phase 2 — deal transaction layer: payments, audit events, receipt,
and the transporter directory.
"""

from datetime import date

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.deal import Deal
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.models.transaction_event import TransactionEvent
from app.models.user import User


def _as(u):
    app.dependency_overrides[get_current_user] = lambda: u


def _client(db):
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _deal(db, farmer_user, buyer_user, *, price=2500, qty=1000, status="delivered"):
    lot = Lot(farmer_id=farmer_user.id, crop="Onion", quantity_kg=qty, quality_grade="A",
              expected_price=2400, available_from=date(2026, 10, 1), location="Pune",
              status="matched")
    dem = Demand(buyer_id=buyer_user.id, crop="Onion", quantity_kg=qty, quality_spec="A",
                 price_band_min=2000, price_band_max=2800, delivery_window="7 days",
                 delivery_district="Nashik", status="matched")
    db.add_all([lot, dem]); db.commit()
    m = Match(lot_id=lot.id, demand_id=dem.id, score=90, status="accepted")
    db.add(m); db.commit()
    d = Deal(match_id=m.id, agreed_price=price, agreed_quantity=qty,
             logistics_mode="hired_transport", payment_status="pending",
             pipeline_status=status)
    db.add(d); db.commit(); db.refresh(d)
    return d


# --------------------------------------------------------------------------- #
# payments
# --------------------------------------------------------------------------- #

def test_buyer_records_payment_and_partial_then_full(db, farmer_user, buyer_user):
    d = _deal(db, farmer_user, buyer_user, price=2500, qty=1000)  # value = 25000
    client = _client(db)
    try:
        _as(buyer_user)
        r1 = client.post(f"/api/deals/{d.id}/payments",
                         json={"amount_inr": 10000, "method": "UPI", "reference": "UPI/123"})
        assert r1.status_code == 201, r1.text
        db.refresh(d)
        assert d.payment_status == "pending"  # only 40% paid

        r2 = client.post(f"/api/deals/{d.id}/payments",
                         json={"amount_inr": 15000, "method": "NEFT", "reference": "NEFT/999"})
        assert r2.status_code == 201
        db.refresh(d)
        assert d.payment_status == "paid"  # 100% now

        rows = client.get(f"/api/deals/{d.id}/payments").json()
        assert len(rows) == 2 and rows[0]["method"] == "UPI"
    finally:
        app.dependency_overrides.clear()


def test_farmer_cannot_record_payment(db, farmer_user, buyer_user):
    d = _deal(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(farmer_user)
        assert client.post(f"/api/deals/{d.id}/payments",
                           json={"amount_inr": 100}).status_code == 403
    finally:
        app.dependency_overrides.clear()


# --------------------------------------------------------------------------- #
# audit events
# --------------------------------------------------------------------------- #

def test_deal_timeline_includes_offer_and_negotiation_events(db, farmer_user, buyer_user):
    """A deal's activity log should carry the offer/match events that produced it,
    not just the deal's own advance/payment rows."""
    from app.models.match import Match
    from app.models.lot import Lot
    from app.models.demand import Demand

    lot = Lot(farmer_id=farmer_user.id, crop="Onion", quantity_kg=1000, quality_grade="A",
              expected_price=2400, available_from=date(2026, 10, 1), location="Pune", status="open")
    dem = Demand(buyer_id=buyer_user.id, crop="Onion", quantity_kg=1000, quality_spec="A",
                 price_band_min=2000, price_band_max=2800, delivery_window="7 days",
                 delivery_district="Pune", status="open")
    db.add_all([lot, dem]); db.commit()
    m = Match(lot_id=lot.id, demand_id=dem.id, score=90, status="proposed")
    db.add(m); db.commit()

    client = _client(db)
    try:
        _as(buyer_user)
        r = client.post(f"/api/matches/{m.id}/offers", json={"price": 2450, "quantity": 1000})
        assert r.status_code == 201
        offer_id = r.json()["id"]
        _as(farmer_user)
        d = client.post(f"/api/offers/{offer_id}/accept")
        assert d.status_code == 200
        deal_id = d.json()["id"]

        events = client.get(f"/api/deals/{deal_id}/events").json()
        actions = [e["action"] for e in events]
        assert "offer_made" in actions
        assert "offer_accepted" in actions
        assert "deal_created" in actions
    finally:
        app.dependency_overrides.clear()


def test_advance_and_payment_write_audit_events(db, farmer_user, buyer_user):
    d = _deal(db, farmer_user, buyer_user, status="delivered")
    client = _client(db)
    try:
        _as(buyer_user)
        client.patch(f"/api/deals/{d.id}/advance",
                     json={"payment_reference": "UPI/abc123"})  # delivered -> paid
        client.post(f"/api/deals/{d.id}/payments", json={"amount_inr": 500})
        events = client.get(f"/api/deals/{d.id}/events").json()
        actions = {e["action"] for e in events}
        assert "advance_to_paid" in actions
        assert "payment_recorded" in actions
        assert db.query(TransactionEvent).count() >= 2
    finally:
        app.dependency_overrides.clear()


# --------------------------------------------------------------------------- #
# receipt
# --------------------------------------------------------------------------- #

def test_receipt_renders_html_with_the_numbers(db, farmer_user, buyer_user):
    d = _deal(db, farmer_user, buyer_user, price=2500, qty=1000)
    client = _client(db)
    try:
        _as(farmer_user)
        r = client.get(f"/api/deals/{d.id}/receipt")
        assert r.status_code == 200
        assert "text/html" in r.headers["content-type"]
        body = r.text
        assert "AgriLink" in body and f"Deal #{d.id}" in body
        assert "25,000" in body  # total deal value
    finally:
        app.dependency_overrides.clear()


def test_receipt_includes_transporter_and_payment_reference(db, farmer_user, buyer_user):
    d = _deal(db, farmer_user, buyer_user, price=2500, qty=1000, status="delivered")
    client = _client(db)
    try:
        _as(buyer_user)
        # attach a logistics plan with a transporter
        client.put(f"/api/deals/{d.id}/logistics", json={
            "mode": "hired_transport", "transporter_name": "Sahyadri Road Carriers",
            "transporter_phone": "+919812000111", "vehicle_type": "truck_6t",
            "status": "in_transit",
        })
        # mark the deal paid with a pipeline-level reference
        client.patch(f"/api/deals/{d.id}/advance",
                     json={"payment_method": "NEFT", "payment_reference": "NEFT/HDFC/AB9931"})
        body = client.get(f"/api/deals/{d.id}/receipt").text
        assert "Sahyadri Road Carriers" in body
        assert "+919812000111" in body
        assert "Truck 6" in body            # vehicle_type "truck_6t" de-underscored
        assert "NEFT/HDFC/AB9931" in body    # confirmed-payment reference
        assert "Confirmed payment" in body
    finally:
        app.dependency_overrides.clear()


def test_receipt_escapes_html_in_user_fields(db, farmer_user, buyer_user):
    d = _deal(db, farmer_user, buyer_user)
    client = _client(db)
    try:
        _as(buyer_user)
        client.put(f"/api/deals/{d.id}/logistics",
                   json={"transporter_name": "<script>alert(1)</script>"})
        body = client.get(f"/api/deals/{d.id}/receipt").text
        assert "<script>alert(1)</script>" not in body
        assert "&lt;script&gt;" in body
    finally:
        app.dependency_overrides.clear()


def test_receipt_access_is_scoped(db, farmer_user, buyer_user):
    d = _deal(db, farmer_user, buyer_user)
    stranger = User(role="farmer", name="Z", phone="+91zzz", district="Pune", taluka="")
    db.add(stranger); db.commit()
    client = _client(db)
    try:
        _as(stranger)
        assert client.get(f"/api/deals/{d.id}/receipt").status_code == 403
    finally:
        app.dependency_overrides.clear()


# --------------------------------------------------------------------------- #
# transporter directory
# --------------------------------------------------------------------------- #

def test_transporter_seed_and_nearby(db, farmer_user):
    from app.services.transporters import seed_transporters

    n = seed_transporters(db)
    assert n > 0
    assert seed_transporters(db) == 0  # idempotent

    client = _client(db)
    try:
        _as(farmer_user)
        # Nashik is the onion belt — the seed has several there
        rows = client.get("/api/transporters/nearby", params={"district": "Nashik", "limit": 5}).json()
        assert len(rows) >= 1
        assert all("name" in t for t in rows)
        if rows[0].get("distance_km") is not None:
            assert rows == sorted(rows, key=lambda t: t["distance_km"] if t["distance_km"] is not None else 1e9)
    finally:
        app.dependency_overrides.clear()
