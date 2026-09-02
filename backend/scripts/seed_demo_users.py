"""Seed demo accounts (+ a little trade data) so every flow can be clicked through.

Idempotent — re-running upserts by phone / (farmer,crop) / (buyer,crop) and
never duplicates. Run from the backend dir:

    venv/Scripts/python.exe -m scripts.seed_demo_users

Demo credentials (phone / password):
    Farmer  +919000000001 / farmer123      Ravi Patil        (Pune)
    Farmer  +919000000002 / farmer123      Sita Deshmukh     (Nashik)
    Buyer   +919000000003 / buyer123       Anita Traders     (Pune)
    Buyer   +919000000004 / buyer123       Mega Foods Pvt    (Mumbai City)
    Admin   +919000000009 / admin123       Platform Admin    (Pune)
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

DEMO_USERS = [
    # phone, name, role, district, taluka, password
    ("+919000000001", "Ravi Patil", "farmer", "Pune", "Haveli", "farmer123"),
    ("+919000000002", "Sita Deshmukh", "farmer", "Nashik", "Niphad", "farmer123"),
    ("+919000000003", "Anita Traders", "buyer", "Pune", "Haveli", "buyer123"),
    ("+919000000004", "Mega Foods Pvt", "buyer", "Mumbai City", "Mumbai", "buyer123"),
    ("+919000000009", "Platform Admin", "admin", "Pune", "Haveli", "admin123"),
]


def _upsert_user(db, phone, name, role, district, taluka, password) -> User:
    user = db.execute(select(User).where(User.phone == phone)).scalar_one_or_none()
    if user is None:
        user = User(phone=phone, name=name, role=role, district=district, taluka=taluka)
        db.add(user)
    user.name = name
    user.role = role
    user.district = district
    user.taluka = taluka
    user.kyc_status = "verified"
    user.is_active = True
    user.password_hash = hash_password(password)
    db.flush()
    return user


def _upsert_lot(db, farmer, crop, qty, grade, price, location) -> Lot:
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
    dem.quantity_kg = qty
    dem.quality_spec = spec
    dem.price_band_min = lo
    dem.price_band_max = hi
    dem.delivery_window = window
    dem.status = "open"
    db.flush()
    return dem


def main() -> None:
    db = SessionLocal()
    try:
        users = {
            row[0]: _upsert_user(db, *row) for row in DEMO_USERS
        }
        ravi = users["+919000000001"]
        sita = users["+919000000002"]
        anita = users["+919000000003"]
        mega = users["+919000000004"]

        # A few open lots and demands so /matches, offers and deals have content.
        _upsert_lot(db, ravi, "Onion", 800, "A", 2450, "Pune")
        _upsert_lot(db, ravi, "Tomato", 500, "B", 1600, "Pune")
        _upsert_lot(db, sita, "Onion", 1200, "A", 2400, "Nashik")

        _upsert_demand(db, anita, "Onion", 1000, "Grade A", 2200, 2700, "Within 7 days")
        _upsert_demand(db, mega, "Onion", 5000, "Grade A or better", 2300, 2800, "Within 2 weeks")
        _upsert_demand(db, anita, "Tomato", 600, "Grade B", 1400, 1800, "Within 5 days")

        # A pool organised by Ravi that Sita joins — for the /pools flow.
        pool = db.execute(
            select(Pool).where(Pool.organizer_id == ravi.id, Pool.crop == "Onion")
        ).scalar_one_or_none()
        if pool is None:
            pool = Pool(organizer_id=ravi.id, crop="Onion", status="open")
            db.add(pool)
        pool.title = "Pune-Nashik onion pool — October"
        pool.target_quantity_kg = 5000
        pool.floor_price = 2300
        pool.grade = "A"
        pool.delivery_window = "Within 2 weeks"
        pool.location = "Pune"
        pool.status = "open"
        db.flush()

        for farmer, qty, price in [(ravi, 800, 2450), (sita, 1200, 2400)]:
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

        db.commit()

        # Score the lot x demand pairs we just created.
        from app.services.matching import run_matching

        n = run_matching(db)

        print("Seeded:")
        for phone, name, role, district, _tk, pw in DEMO_USERS:
            print(f"  {role:6}  {phone} / {pw:9}  {name} ({district})")
        print(f"\n  3 lots, 3 demands, 1 pool (2 members). run_matching upserted {n} matches.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
