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
    return db.execute(
        select(PriceCache.modal_price)
        .where(PriceCache.crop == crop, PriceCache.market == market)
        .order_by(PriceCache.date.desc())
        .limit(1)
    ).scalar_one_or_none()


def evaluate_alerts(db: Session) -> int:
    """Returns the number of notifications created."""
    now = datetime.now(timezone.utc)
    alerts = db.execute(select(PriceAlert).where(PriceAlert.active.is_(True))).scalars().all()
    created = 0
    for a in alerts:
        if a.last_triggered_at is not None:
            last = a.last_triggered_at
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            if now - last < _DEBOUNCE:
                continue
        modal = _latest_modal(db, a.crop, a.market)
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
