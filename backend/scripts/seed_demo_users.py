"""Seed demo accounts + a full trade dataset so every flow can be clicked through.

Idempotent — re-running upserts users / lots / demands / pools by natural key and
only creates offers, deals, payments, disputes, forward contracts and alerts when
none exist yet. Run from the backend dir:

    venv/Scripts/python.exe -m scripts.seed_demo_users            # append / upsert
    venv/Scripts/python.exe -m scripts.seed_demo_users --reset    # wipe trade tables first

``--reset`` clears every transactional table (deals, offers, matches, logistics,
payments, disputes, forward_*, pools, lots, demands, alerts, notifications,
transaction_events) and reseeds from scratch — use it on a dev DB when you want a
known-good state. It never touches users, price_cache, transporters or geo_cache.

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

from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.deal import Deal
from app.models.demand import Demand
from app.models.dispute import Dispute
from app.models.forward import ForwardBid, ForwardCommitment
from app.models.logistics import DealLogistics
from app.models.lot import Lot
from app.models.match import Match
from app.models.offer import Offer
from app.models.payment import DealPayment
from app.models.pool import Pool, PoolMember
from app.models.price_alert import PriceAlert
from app.models.transaction_event import TransactionEvent
from app.models.user import User
from app.services.audit import log_event

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
    "+919000000016": ("Salem Fresh Mart", "buyer", "Salem", "Salem", "buyer123", "Tamil Nadu", 11.6643, 78.1460, "verified"),
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


# pipeline stages, mirrored from app.api.deals.PIPELINE_STAGES (kept local so the
# seed doesn't drag in the FastAPI app just to walk the list).
_STAGES = ["matched", "offer_accepted", "logistics_arranged", "delivered", "paid", "closed"]


def _match_for(db, lot: Lot, demand: Demand) -> Match | None:
    return db.execute(
        select(Match).where(Match.lot_id == lot.id, Match.demand_id == demand.id)
    ).scalar_one_or_none()


def _seed_deal(
    db, match: Match, buyer: User, farmer: User, price: float, qty: float,
    *, stage: str, pay_fraction: float, dispute_reason: str | None = None,
) -> Deal | None:
    """Idempotent. If a Deal already exists for this match, no-op. Otherwise run
    a short offer thread (buyer opens low → farmer counters → buyer accepts at
    `price`), create the Deal, walk the pipeline to `stage`, and attach a
    logistics plan + a payment instalment (+ an optional open dispute). Mirrors
    offers.accept_offer, deals.advance and deals.record_payment so the seeded
    rows look exactly like API-produced ones."""
    if db.execute(select(Deal).where(Deal.match_id == match.id)).scalar_one_or_none():
        return None

    o_open = Offer(match_id=match.id, from_user_id=buyer.id, price=round(price - 100),
                   quantity=qty, message="Opening offer", status="countered")
    o_counter = Offer(match_id=match.id, from_user_id=farmer.id, price=round(price + 60),
                      quantity=qty, message="Counter — quality is top grade", status="countered")
    o_final = Offer(match_id=match.id, from_user_id=buyer.id, price=price,
                    quantity=qty, message="Agreed — booking transport", status="accepted")
    db.add_all([o_open, o_counter, o_final])
    match.status = "accepted"
    # mirror offers.accept_offer: take the lot + demand off the open market and
    # reject any other still-open matches that involve either of them.
    lot = db.get(Lot, match.lot_id)
    demand = db.get(Demand, match.demand_id)
    if lot:
        lot.status = "matched"
    if demand:
        demand.status = "matched"
    for sib in db.execute(
        select(Match).where(
            Match.id != match.id,
            Match.status.in_(("proposed", "offered")),
            (Match.lot_id == match.lot_id) | (Match.demand_id == match.demand_id),
        )
    ).scalars().all():
        sib.status = "rejected"
    db.flush()

    deal = Deal(match_id=match.id, agreed_price=price, agreed_quantity=qty,
                logistics_mode="hired_transport", payment_status="pending",
                pipeline_status="matched")
    db.add(deal)
    db.flush()
    log_event(db, actor_id=buyer.id, entity_type="match", entity_id=match.id,
              action="offer_accepted",
              detail={"offer_id": o_final.id, "price": price, "quantity": qty})
    log_event(db, actor_id=buyer.id, entity_type="deal", entity_id=deal.id,
              action="deal_created",
              detail={"from": "offer", "agreed_price": price, "agreed_quantity": qty})

    target = _STAGES.index(stage)
    for st in _STAGES[1:target + 1]:
        deal.pipeline_status = st
        actor = farmer.id if st == "delivered" else buyer.id
        log_event(db, actor_id=actor, entity_type="deal", entity_id=deal.id,
                  action=f"advance_to_{st}", detail={"from": _STAGES[_STAGES.index(st) - 1]})

    lg = DealLogistics(
        deal_id=deal.id, mode="hired_transport",
        transporter_name="Kongu Roadlines" if farmer.state == "Tamil Nadu" else "Sahyadri Transport",
        transporter_phone="+919000500500", vehicle_type="10-tyre truck",
        pickup_point=farmer.district, drop_point=buyer.district,
        distance_km=None, est_cost_inr=None,
        status="delivered" if target >= _STAGES.index("delivered") else "planned",
        notes="Seed logistics plan",
    )
    db.add(lg)

    agreed_value = price * qty / 100.0
    amount = round(agreed_value * pay_fraction)
    if amount > 0:
        db.add(DealPayment(deal_id=deal.id, payer_id=buyer.id, amount_inr=amount,
                           method="UPI", reference=f"UTR{deal.id:06d}25", note="Seed payment"))
        log_event(db, actor_id=buyer.id, entity_type="payment", entity_id=deal.id,
                  action="payment_recorded",
                  detail={"amount_inr": amount, "method": "UPI", "total_so_far": amount})
        if amount >= agreed_value * 0.999:
            deal.payment_status = "paid"
            deal.payment_method = "UPI"
            deal.payment_reference = f"UTR{deal.id:06d}25"

    if dispute_reason:
        db.add(Dispute(deal_id=deal.id, raised_by=buyer.id, reason=dispute_reason, status="open"))
        log_event(db, actor_id=buyer.id, entity_type="deal", entity_id=deal.id,
                  action="dispute_raised", detail={"reason": dispute_reason})
    return deal


def _seed_forward(db, buyer: User, farmer_pending: User, farmer_accept: User) -> None:
    """A Turmeric forward bid with one pending commitment and one accepted
    commitment (which materialises into the deal pipeline, mirroring
    forward.accept_commitment)."""
    bid = db.execute(
        select(ForwardBid).where(ForwardBid.buyer_id == buyer.id, ForwardBid.crop == "Turmeric")
    ).scalar_one_or_none()
    if bid is None:
        bid = ForwardBid(
            buyer_id=buyer.id, crop="Turmeric", quantity_kg=3000,
            price_min=12500, price_max=16000,
            delivery_from=date.today() + timedelta(days=56),
            delivery_to=date.today() + timedelta(days=84),
            delivery_district=buyer.district, latitude=buyer.latitude, longitude=buyer.longitude,
            quality_grade_min="FAQ", notes="Export-grade Erode turmeric — finger + bulb, cured.",
            status="open",
        )
        db.add(bid)
        db.flush()
        log_event(db, actor_id=buyer.id, entity_type="forward_bid", entity_id=bid.id,
                  action="forward_bid_created",
                  detail={"crop": "Turmeric", "quantity_kg": 3000,
                          "price_band": [12000, 15000]})

    def _has_commitment(farmer):
        return db.execute(
            select(ForwardCommitment).where(
                ForwardCommitment.bid_id == bid.id,
                ForwardCommitment.farmer_id == farmer.id,
            )
        ).scalar_one_or_none()

    if not _has_commitment(farmer_pending):
        c = ForwardCommitment(
            bid_id=bid.id, farmer_id=farmer_pending.id, quantity_kg=2000,
            price_per_qtl=13500, expected_ready=date.today() + timedelta(days=63),
            note="Rabi turmeric, curing complete.", status="pending",
        )
        db.add(c)
        db.flush()
        log_event(db, actor_id=farmer_pending.id, entity_type="forward_bid", entity_id=bid.id,
                  action="forward_commitment_made",
                  detail={"commitment_id": c.id, "quantity_kg": 2000, "price_per_qtl": 13500})

    if not _has_commitment(farmer_accept):
        c = ForwardCommitment(
            bid_id=bid.id, farmer_id=farmer_accept.id, quantity_kg=1000,
            price_per_qtl=13000, expected_ready=date.today() + timedelta(days=70),
            note="First pick.", status="pending",
        )
        db.add(c)
        db.flush()
        # buyer accepts -> materialise Lot + Demand + Match + Offer + Deal (matched)
        lot = Lot(
            farmer_id=farmer_accept.id, crop=bid.crop, quantity_kg=c.quantity_kg,
            quality_grade=bid.quality_grade_min or "FAQ", expected_price=c.price_per_qtl,
            available_from=c.expected_ready,
            location=farmer_accept.district or bid.delivery_district or "",
            latitude=farmer_accept.latitude, longitude=farmer_accept.longitude, status="matched",
        )
        db.add(lot)
        db.flush()
        dem = Demand(
            buyer_id=bid.buyer_id, crop=bid.crop, quantity_kg=c.quantity_kg,
            quality_spec=f"Forward contract (grade >= {bid.quality_grade_min or 'FAQ'})",
            quality_grade_min=bid.quality_grade_min,
            price_band_min=bid.price_min, price_band_max=bid.price_max,
            delivery_window=f"{bid.delivery_from.isoformat()} to {bid.delivery_to.isoformat()}",
            delivery_district=bid.delivery_district or "",
            latitude=bid.latitude, longitude=bid.longitude, status="matched",
        )
        db.add(dem)
        db.flush()
        m = Match(lot_id=lot.id, demand_id=dem.id, score=100.0, status="accepted")
        db.add(m)
        db.flush()
        db.add(Offer(match_id=m.id, from_user_id=c.farmer_id, price=c.price_per_qtl,
                     quantity=c.quantity_kg, message=f"Forward commitment #{c.id}",
                     status="accepted"))
        deal = Deal(match_id=m.id, agreed_price=c.price_per_qtl, agreed_quantity=c.quantity_kg,
                    logistics_mode="hired_transport", payment_status="pending",
                    pipeline_status="matched")
        db.add(deal)
        db.flush()
        c.status = "accepted"
        c.deal_id = deal.id
        # 1000 of 3000 kg accepted -> bid stays "open"
        log_event(db, actor_id=buyer.id, entity_type="forward_bid", entity_id=bid.id,
                  action="forward_commitment_accepted",
                  detail={"commitment_id": c.id, "deal_id": deal.id, "farmer_id": c.farmer_id,
                          "quantity_kg": c.quantity_kg, "price_per_qtl": c.price_per_qtl})
        log_event(db, actor_id=buyer.id, entity_type="deal", entity_id=deal.id,
                  action="deal_created",
                  detail={"from": "forward", "bid_id": bid.id, "commitment_id": c.id})


def _seed_alerts(db, rows) -> None:
    for user, crop, market, direction, threshold in rows:
        exists = db.execute(
            select(PriceAlert).where(
                PriceAlert.user_id == user.id, PriceAlert.crop == crop,
                PriceAlert.market == market,
            )
        ).scalar_one_or_none()
        if exists is None:
            db.add(PriceAlert(user_id=user.id, crop=crop, market=market,
                              direction=direction, threshold=threshold, active=True))


def _reset_trade_tables(db) -> None:
    """Truncate every transactional table and restart its id sequence, so a
    reseed produces clean deal#1 / bid#1 ids. Keeps users, price_cache,
    transporters and geo_cache."""
    from sqlalchemy import text

    tables = (
        "transaction_events", "deal_payments", "deal_logistics", "disputes",
        "forward_commitments", "forward_bids", "offers",
        "pool_members", "pools", "deals", "matches",
        "price_alerts", "notifications", "lots", "demands",
    )
    db.execute(text("TRUNCATE " + ", ".join(tables) + " RESTART IDENTITY CASCADE"))
    db.commit()


def main(reset: bool = False) -> None:
    db = SessionLocal()
    try:
        if reset:
            _reset_trade_tables(db)
        u = {phone: _upsert_user(db, phone, *row) for phone, row in DEMO_USERS.items()}
        ravi, sita = u["+919000000001"], u["+919000000002"]
        anita, mega = u["+919000000003"], u["+919000000004"]
        murugan, lakshmi = u["+919000000011"], u["+919000000012"]
        kovai, tnagro, chennai = u["+919000000013"], u["+919000000014"], u["+919000000015"]
        salem = u["+919000000016"]

        # Prices are set to bracket the live AGMARKNET mandi averages for each
        # crop/state (Onion ~₹3,700/qtl MH, ~₹5,500 TN; Tomato ~₹1,350 MH;
        # Turmeric ~₹12,800 TN) so best-market, the sell/wait signal and the
        # price-realisation scorecard all read sensibly.

        # --- Maharashtra trade data ---
        ravi_onion = _upsert_lot(db, ravi, "Onion", 800, "A", 3750, "Pune", 18.5204, 73.8567)
        _upsert_lot(db, ravi, "Tomato", 500, "B", 1350, "Pune", 18.5204, 73.8567)
        _upsert_lot(db, sita, "Onion", 1200, "A", 3700, "Nashik", 19.9975, 73.7898)
        anita_onion = _upsert_demand(db, anita, "Onion", 1000, "Grade A", 3400, 4200, "Within 7 days")
        _upsert_demand(db, mega, "Onion", 5000, "Grade A or better", 3500, 4300, "Within 2 weeks")
        _upsert_demand(db, anita, "Tomato", 600, "Grade B", 1150, 1600, "Within 5 days")
        _upsert_pool(db, ravi, "Onion", "Pune-Nashik onion pool — October", 5000, 3500,
                     "A", "Within 2 weeks", "Pune", [(ravi, 800, 3750), (sita, 1200, 3700)])

        # --- Tamil Nadu / Coimbatore trade data ---
        murugan_onion = _upsert_lot(db, murugan, "Onion", 1000, "A", 5400, "Coimbatore", 11.0168, 76.9558)
        _upsert_lot(db, murugan, "Tomato", 600, "B", 1450, "Coimbatore", 11.0168, 76.9558)
        _upsert_lot(db, lakshmi, "Turmeric", 2000, "A", 13000, "Erode", 11.3410, 77.7172)
        # Kovai (Coimbatore) — should strong-match Murugan's onion lot (0 km)
        kovai_onion = _upsert_demand(db, kovai, "Onion", 1200, "Grade A", 5200, 6100, "Within 7 days")
        # TN Agro (Madurai, ~176 km from Erode) — should match Lakshmi's turmeric
        _upsert_demand(db, tnagro, "Turmeric", 5000, "Grade A", 12500, 15500, "Within 3 weeks")
        # Chennai Exports (~450 km from Coimbatore) — must NOT match the Coimbatore
        # onion lot: the radius veto rejects it despite a perfect price fit.
        _upsert_demand(db, chennai, "Onion", 2000, "Grade A", 5200, 6200, "Within 10 days")
        # Salem (~160 km from Coimbatore) — an open onion demand that survives the
        # Murugan↔Kovai deal, so the discovery board and the Decision Brief still
        # have a live nearby buyer for onion.
        _upsert_demand(db, salem, "Onion", 1500, "Grade A", 5300, 6000, "Within 10 days")
        _upsert_pool(db, murugan, "Turmeric", "Kongu belt turmeric pool", 10000, 12500,
                     "A", "Within 3 weeks", "Coimbatore", [(murugan, 800, 12800), (lakshmi, 2000, 13000)])

        db.commit()

        from app.services.matching import run_matching
        n = run_matching(db)

        # --- transactional data: full offer→deal→payment lifecycle ---------
        mh = _match_for(db, ravi_onion, anita_onion)
        if mh:
            _seed_deal(db, mh, anita, ravi, price=3950, qty=800,
                       stage="closed", pay_fraction=1.0)
        tn = _match_for(db, murugan_onion, kovai_onion)
        if tn:
            _seed_deal(db, tn, kovai, murugan, price=5750, qty=1000,
                       stage="delivered", pay_fraction=0.4,
                       dispute_reason="Delivered load was ~55 kg short of the agreed 1000 kg; "
                                      "requesting a price adjustment before final payment.")

        _seed_forward(db, buyer=kovai, farmer_pending=lakshmi, farmer_accept=murugan)

        _seed_alerts(db, [
            (murugan, "Onion", "Kurichi(Uzhavar Sandhai )", "below", 2000),
            (ravi, "Onion", "Pune", "above", 2650),
        ])

        db.commit()

        counts = {
            t: db.execute(select(func.count()).select_from(m)).scalar()
            for t, m in [("offers", Offer), ("deals", Deal), ("deal_payments", DealPayment),
                         ("disputes", Dispute), ("forward_bids", ForwardBid),
                         ("forward_commitments", ForwardCommitment), ("price_alerts", PriceAlert),
                         ("transaction_events", TransactionEvent)]
        }

        print("Seeded:")
        for phone, row in DEMO_USERS.items():
            name, role, district, _tk, pw = row[:5]
            v = row[8]
            print(f"  {role:6}  {phone} / {pw:9}  {name:22} ({district}, {row[5]})  [{v}]")
        print(f"\n  run_matching upserted {n} matches.")
        print("  transactional rows: " + ", ".join(f"{k}={v}" for k, v in counts.items()))
    finally:
        db.close()


if __name__ == "__main__":
    import sys

    main(reset="--reset" in sys.argv)
