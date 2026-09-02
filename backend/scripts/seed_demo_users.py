"""Seed demo accounts (+ a little trade data) so every flow can be clicked through.

Idempotent — re-running upserts by phone / (farmer,crop) / (buyer,crop) and
never duplicates. Run from the backend dir:

    venv/Scripts/python.exe -m scripts.seed_demo_users

Two clusters: Maharashtra (the SIH home region) and Tamil Nadu / Kongu belt
around Coimbatore so the 200 km radius, distance-aware matching and the
verification queue can all be checked from a Coimbatore login.

Coimbatore-area logins (all password farmer123 / buyer123):
    +919000000011  Murugan Selvam       farmer  Coimbatore   verified   (onion + tomato lots, runs a turmeric pool)
    +919000000012  Lakshmi Farms (FPO)  farmer  Erode        PENDING    (turmeric lot, in the verify queue)
    +919000000013  Kovai Traders        buyer   Coimbatore   verified   (onion demand → strong-matches Murugan)
    +919000000014  TN Agro Buyers       buyer   Madurai      PENDING    (turmeric demand)
    +919000000015  Chennai Exports Co   buyer   Chennai      verified   (onion demand — 450 km, radius-vetoed, 0 matches)
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.pool import Pool, PoolMember
from app.models.user import User

# key: (name, role, district, taluka, password, state, lat, lon, verification)
DEMO_USERS: dict[str, tuple] = {
    # --- Maharashtra ---
    "+919000000001": ("Ravi Patil", "farmer", "Pune", "Haveli", "farmer123", "Maharashtra", 18.5204, 73.8567, "verified"),
    "+919000000002": ("Sita Deshmukh", "farmer", "Nashik", "Niphad", "farmer123", "Maharashtra", 19.9975, 73.7898, "verified"),
    "+919000000003": ("Anita Traders", "buyer", "Pune", "Haveli", "buyer123", "Maharashtra", 18.5204, 73.8567, "verified"),
    "+919000000004": ("Mega Foods Pvt", "buyer", "Mumbai City", "Mumbai", "buyer123", "Maharashtra", 19.0760, 72.8777, "verified"),
    "+919000000009": ("Platform Admin", "admin", "Pune", "Haveli", "admin123", "Maharashtra", 18.5204, 73.8567, "verified"),
    # --- Tamil Nadu / Kongu belt around Coimbatore ---
    "+919000000011": ("Murugan Selvam", "farmer", "Coimbatore", "Pollachi", "farmer123", "Tamil Nadu", 11.0168, 76.9558, "verified"),
    "+919000000012": ("Lakshmi Farms (FPO)", "farmer", "Erode", "Perundurai", "farmer123", "Tamil Nadu", 11.3410, 77.7172, "pending"),
    "+919000000013": ("Kovai Traders", "buyer", "Coimbatore", "Coimbatore", "buyer123", "Tamil Nadu", 11.0168, 76.9558, "verified"),
    "+919000000014": ("TN Agro Buyers", "buyer", "Madurai", "Madurai", "buyer123", "Tamil Nadu", 9.9252, 78.1198, "pending"),
    "+919000000015": ("Chennai Exports Co", "buyer", "Chennai", "Chennai", "buyer123", "Tamil Nadu", 13.0827, 80.2707, "verified"),
}


def _upsert_user(db, phone, name, role, district, taluka, password, state, lat, lon, verification) -> User:
    user = db.execute(select(User).where(User.phone == phone)).scalar_one_or_none()
    if user is None:
        user = User(phone=phone, name=name, role=role, district=district, taluka=taluka)
        db.add(user)
    user.name = name
    user.role = role
    user.district = district
    user.taluka = taluka
    user.state = state
    user.latitude = lat
    user.longitude = lon
    user.verification_status = verification
    user.kyc_status = "verified" if verification == "verified" else "unverified"
    if verification in ("pending", "rejected"):
        user.verification_ref = "GSTIN 33ABCDE1234F1Z5"
        user.verification_note = "Requested via demo seed"
    user.is_active = True
    user.password_hash = hash_password(password)
    db.flush()
    return user


def _upsert_lot(db, farmer, crop, qty, grade, price, location, lat, lon) -> Lot:
    lot = db.execute(
        select(Lot).where(Lot.farmer_id == farmer.id, Lot.crop == crop)
    ).scalar_one_or_none()
    if lot is None:
        lot = Lot(farmer_id=farmer.id, crop=crop, status="open")
        db.add(lot)
    lot.quantity_kg = qty
    lot.quality_grade = grade
    lot.expected_price = price
    lot.available_from = date.today() + timedelta(days=3)
    lot.location = location
    lot.latitude = lat
    lot.longitude = lon
    lot.status = "open"
    db.flush()
    return lot


def _upsert_demand(db, buyer, crop, qty, spec, lo, hi, window) -> Demand:
    dem = db.execute(
        select(Demand).where(Demand.buyer_id == buyer.id, Demand.crop == crop)
    ).scalar_one_or_none()
    if dem is None:
        dem = Demand(buyer_id=buyer.id, crop=crop, status="open")
        db.add(dem)
    dem.delivery_district = buyer.district
    dem.latitude = buyer.latitude
    dem.longitude = buyer.longitude
    dem.quantity_kg = qty
    dem.quality_spec = spec
    dem.price_band_min = lo
    dem.price_band_max = hi
    dem.delivery_window = window
    dem.status = "open"
    db.flush()
    return dem


def _upsert_pool(db, organizer, crop, title, target, floor, grade, window, location, members) -> None:
    pool = db.execute(
        select(Pool).where(Pool.organizer_id == organizer.id, Pool.crop == crop)
    ).scalar_one_or_none()
    if pool is None:
        pool = Pool(organizer_id=organizer.id, crop=crop, status="open")
        db.add(pool)
    pool.title = title
    pool.target_quantity_kg = target
    pool.floor_price = floor
    pool.grade = grade
    pool.delivery_window = window
    pool.location = location
    pool.latitude = organizer.latitude
    pool.longitude = organizer.longitude
    pool.status = "open"
    db.flush()
    for farmer, qty, price in members:
        m = db.execute(
            select(PoolMember).where(
                PoolMember.pool_id == pool.id, PoolMember.farmer_id == farmer.id
            )
        ).scalar_one_or_none()
        if m is None:
            m = PoolMember(pool_id=pool.id, farmer_id=farmer.id)
            db.add(m)
        m.quantity_kg = qty
        m.expected_price = price
        m.status = "committed"


def main() -> None:
    db = SessionLocal()
    try:
        u = {phone: _upsert_user(db, phone, *row) for phone, row in DEMO_USERS.items()}
        ravi, sita = u["+919000000001"], u["+919000000002"]
        anita, mega = u["+919000000003"], u["+919000000004"]
        murugan, lakshmi = u["+919000000011"], u["+919000000012"]
        kovai, tnagro, chennai = u["+919000000013"], u["+919000000014"], u["+919000000015"]

        # --- Maharashtra trade data ---
        _upsert_lot(db, ravi, "Onion", 800, "A", 2450, "Pune", 18.5204, 73.8567)
        _upsert_lot(db, ravi, "Tomato", 500, "B", 1600, "Pune", 18.5204, 73.8567)
        _upsert_lot(db, sita, "Onion", 1200, "A", 2400, "Nashik", 19.9975, 73.7898)
        _upsert_demand(db, anita, "Onion", 1000, "Grade A", 2200, 2700, "Within 7 days")
        _upsert_demand(db, mega, "Onion", 5000, "Grade A or better", 2300, 2800, "Within 2 weeks")
        _upsert_demand(db, anita, "Tomato", 600, "Grade B", 1400, 1800, "Within 5 days")
        _upsert_pool(db, ravi, "Onion", "Pune-Nashik onion pool — October", 5000, 2300,
                     "A", "Within 2 weeks", "Pune", [(ravi, 800, 2450), (sita, 1200, 2400)])

        # --- Tamil Nadu / Coimbatore trade data ---
        _upsert_lot(db, murugan, "Onion", 1000, "A", 2400, "Coimbatore", 11.0168, 76.9558)
        _upsert_lot(db, murugan, "Tomato", 600, "B", 1500, "Coimbatore", 11.0168, 76.9558)
        _upsert_lot(db, lakshmi, "Turmeric", 2000, "A", 13000, "Erode", 11.3410, 77.7172)
        # Kovai (Coimbatore) — should strong-match Murugan's onion lot (0 km)
        _upsert_demand(db, kovai, "Onion", 1200, "Grade A", 2200, 2700, "Within 7 days")
        # TN Agro (Madurai, ~176 km from Erode) — should match Lakshmi's turmeric
        _upsert_demand(db, tnagro, "Turmeric", 5000, "Grade A", 12000, 15000, "Within 3 weeks")
        # Chennai Exports (~450 km from Coimbatore) — must NOT match the Coimbatore
        # onion lot: the radius veto rejects it despite a perfect price fit.
        _upsert_demand(db, chennai, "Onion", 2000, "Grade A", 2200, 2800, "Within 10 days")
        _upsert_pool(db, murugan, "Turmeric", "Kongu belt turmeric pool", 10000, 12500,
                     "A", "Within 3 weeks", "Coimbatore", [(murugan, 800, 12800), (lakshmi, 2000, 13000)])

        db.commit()

        from app.services.matching import run_matching
        n = run_matching(db)

        print("Seeded:")
        for phone, row in DEMO_USERS.items():
            name, role, district, _tk, pw = row[:5]
            v = row[8]
            print(f"  {role:6}  {phone} / {pw:9}  {name:22} ({district}, {row[5]})  [{v}]")
        print(f"\n  Maharashtra + Tamil Nadu clusters. run_matching upserted {n} matches.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
