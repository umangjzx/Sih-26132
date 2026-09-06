"""Forward-contract settlement monitoring (v1.8).

An accepted forward commitment materialises into a normal Deal — but nothing
previously checked whether that deal actually reached delivery by the date
the farmer and buyer agreed to. This is not an escrow or penalty system (the
platform never holds money or crop), only visibility: a debounced in-app
reminder to both parties, so a stalled commitment surfaces instead of quietly
going nowhere.
"""

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.deal import Deal
from app.models.forward import ForwardBid, ForwardCommitment
from app.models.notification import Notification

logger = logging.getLogger(__name__)

# A deal at or past this pipeline stage means the crop was actually delivered —
# the forward contract's real obligation — regardless of payment/close status.
_SETTLED_STAGES = {"delivered", "paid", "closed"}
_REMINDER_COOLDOWN = timedelta(days=7)


def check_settlement_risk(db: Session) -> int:
    """Flag accepted forward commitments whose settlement date has passed with
    no delivery yet. Returns the number of notifications created (2 per
    newly-flagged commitment: one for the farmer, one for the buyer)."""
    today = date.today()
    now = datetime.now(timezone.utc)

    rows = db.execute(
        select(ForwardCommitment, Deal, ForwardBid)
        .join(Deal, Deal.id == ForwardCommitment.deal_id)
        .join(ForwardBid, ForwardBid.id == ForwardCommitment.bid_id)
        .where(
            ForwardCommitment.status == "accepted",
            ForwardCommitment.settlement_due.is_not(None),
            ForwardCommitment.settlement_due < today,
            Deal.pipeline_status.not_in(_SETTLED_STAGES),
        )
    ).all()

    created = 0
    for c, deal, bid in rows:
        sent = c.settlement_reminder_sent_at
        if sent is not None:
            if sent.tzinfo is None:
                sent = sent.replace(tzinfo=timezone.utc)
            if now - sent < _REMINDER_COOLDOWN:
                continue

        days_overdue = (today - c.settlement_due).days
        title = f"Forward contract for {bid.crop} is {days_overdue}d overdue"
        body = (
            f"Commitment #{c.id} was due to be delivered by {c.settlement_due.isoformat()} "
            f"but deal #{deal.id} is still at '{deal.pipeline_status}'."
        )
        link = f"/deals/{deal.id}"
        db.add(Notification(
            user_id=c.farmer_id, kind="deal", title=title, body=body, link=link,
        ))
        db.add(Notification(
            user_id=bid.buyer_id, kind="deal", title=title, body=body, link=link,
        ))
        c.settlement_reminder_sent_at = now
        created += 2

    if created:
        db.commit()
        logger.info("check_settlement_risk: %d notification(s) created", created)
    return created
