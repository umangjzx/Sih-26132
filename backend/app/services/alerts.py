"""Evaluate standing price alerts after each ingestion cycle and drop an in-app
notification when one fires. De-bounced to at most once per 20 hours per alert.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.price_alert import PriceAlert
from app.models.price_cache import PriceCache

logger = logging.getLogger(__name__)

_DEBOUNCE = timedelta(hours=20)


def _latest_modal(db: Session, crop: str, market: str) -> float | None:
    """Latest modal price for a crop+market. Exact match first (index-friendly),
    then a case-insensitive retry so an alert typed 'onion'/'pune' still fires."""
    def _q(ci: bool):
        crop_c = PriceCache.crop.ilike(crop.strip()) if ci else PriceCache.crop == crop
        mkt_c = PriceCache.market.ilike(market.strip()) if ci else PriceCache.market == market
        return db.execute(
            select(PriceCache.modal_price)
            .where(crop_c, mkt_c)
            .order_by(PriceCache.date.desc())
            .limit(1)
        ).scalar_one_or_none()

    v = _q(False)
    return v if v is not None else _q(True)


def evaluate_alerts(db: Session) -> int:
    """Returns the number of notifications created."""
    now = datetime.now(timezone.utc)
    alerts = db.execute(select(PriceAlert).where(PriceAlert.active.is_(True))).scalars().all()

    # many users watch the same crop+market — resolve each pair's latest modal
    # once, not once per alert.
    modal_cache: dict[tuple[str, str], float | None] = {}

    def latest(crop: str, market: str) -> float | None:
        key = (crop.strip().lower(), market.strip().lower())
        if key not in modal_cache:
            modal_cache[key] = _latest_modal(db, crop, market)
        return modal_cache[key]

    created = 0
    for a in alerts:
        if a.last_triggered_at is not None:
            last = a.last_triggered_at
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            if now - last < _DEBOUNCE:
                continue
        modal = latest(a.crop, a.market)
        if modal is None:
            continue
        fired = (a.direction == "above" and modal >= a.threshold) or (
            a.direction == "below" and modal <= a.threshold
        )
        if not fired:
            continue
        db.add(
            Notification(
                user_id=a.user_id,
                kind="price_alert",
                title=f"{a.crop} at {a.market} is {'above' if a.direction == 'above' else 'below'} ₹{a.threshold:.0f}",
                body=f"Latest modal price is ₹{modal:.0f}/quintal.",
                link=f"/?crop={a.crop}&market={a.market}",
            )
        )
        a.last_triggered_at = now
        created += 1
    if created:
        db.commit()
        logger.info("evaluate_alerts: %d notification(s) created", created)
    return created
