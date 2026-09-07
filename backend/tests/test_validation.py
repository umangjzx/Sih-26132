"""v1.4 phase 4 — the validation pass: phone format, quantity / price sanity."""


def test_register_rejects_bad_phone(auth_client):
    for bad in ("hello", "12345", "+91 999", "999999999999999999999"):
        r = auth_client.post("/api/auth/register", json={
            "phone": bad, "name": "X", "role": "farmer", "password": "secret1",
        })
        assert r.status_code == 422, bad


def test_register_normalises_phone(auth_client, db):
    from app.models.user import User

    r = auth_client.post("/api/auth/register", json={
        "phone": " +91 98765-43210 ", "name": "Ravi", "role": "farmer", "password": "secret123",
    })
    assert r.status_code == 201, r.text
    assert db.query(User).filter(User.phone == "+919876543210").one()


def test_register_rejects_blank_name(auth_client):
    r = auth_client.post("/api/auth/register", json={
        "phone": "+919000000123", "name": "   ", "role": "farmer", "password": "secret1",
    })
    assert r.status_code == 422


def test_lot_quantity_and_price_sanity(farmer_client):
    base = {"crop": "Onion", "quality_grade": "A", "available_from": "2026-10-01", "location": "Pune"}
    assert farmer_client.post("/api/lots/", json={
        **base, "quantity_kg": 50_000_000, "expected_price": 2400,
    }).status_code == 422
    assert farmer_client.post("/api/lots/", json={
        **base, "quantity_kg": 500, "expected_price": 9_000_000,
    }).status_code == 422
    assert farmer_client.post("/api/lots/", json={
        **base, "quantity_kg": 500, "expected_price": 2400,
    }).status_code == 201


def test_lot_rejects_available_from_too_far_in_the_past(farmer_client):
    """v1.21 audit fix — a fat-fingered date like 1900-01-01 used to pass
    validation and silently feed into the matcher's timing_factor."""
    base = {"crop": "Onion", "quality_grade": "A", "location": "Pune",
            "quantity_kg": 500, "expected_price": 2400}
    assert farmer_client.post("/api/lots/", json={
        **base, "available_from": "1900-01-01",
    }).status_code == 422
    # a lot harvested a few weeks ago and only now listed is still legitimate
    assert farmer_client.post("/api/lots/", json={
        **base, "available_from": "2026-08-01",
    }).status_code == 201


def test_register_rejects_all_digit_password(auth_client):
    """v1.21 audit fix — a pure numeric string like a PIN was previously an
    acceptable password with no letter required at all."""
    r = auth_client.post("/api/auth/register", json={
        "phone": "+910000000099", "name": "Numeric", "role": "farmer", "password": "12345678",
    })
    assert r.status_code == 422


def test_demand_price_band_order_and_sanity(buyer_client):
    base = {"crop": "Onion", "quantity_kg": 500, "quality_spec": "A", "delivery_window": "7 days"}
    # max < min
    assert buyer_client.post("/api/demands/", json={
        **base, "price_band_min": 2500, "price_band_max": 2000,
    }).status_code == 422
    # absurd price
    assert buyer_client.post("/api/demands/", json={
        **base, "price_band_min": 2000, "price_band_max": 9_000_000,
    }).status_code == 422
