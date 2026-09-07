"""Opt-in SMS digest for farmers/buyers without a reliable data plan (v1.14).

The in-app notification bell already exists for anyone using the app
day-to-day; this is for the farmer who doesn't reliably open it. A user opts
in explicitly via ``PATCH /api/auth/me {sms_digest_enabled: true}`` — off by
default, nothing is ever texted without that. Once opted in, an unread
notification (a price alert firing, a deal update, a dispute event) earns
them a short SMS summary at most once per `_DIGEST_COOLDOWN`, via the same
``services/sms.py`` delivery used by the forgot-password OTP (degrades to a
server-log line without ``SMS_API_KEY`` configured).
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User
from app.services.sms import send_sms

logger = logging.getLogger(__name__)

_DIGEST_COOLDOWN = timedelta(hours=20)


def send_sms_digests(db: Session) -> int:
    """Text a short unread-notification summary to every opted-in, active
    user who has at least one unread notification, debounced. Returns how
    many digests were actually sent."""
    users = db.execute(
        select(User).where(User.sms_digest_enabled.is_(True), User.is_active.is_(True))
    ).scalars().all()

    now = datetime.now(timezone.utc)
    sent = 0
    for user in users:
        last = user.sms_digest_sent_at
        if last is not None:
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            if now - last < _DIGEST_COOLDOWN:
                continue

        unread = db.execute(
            select(Notification)
            .where(Notification.user_id == user.id, Notification.read.is_(False))
            .order_by(Notification.created_at.desc())
        ).scalars().all()
        if not unread:
            continue

        top = unread[0]
        extra = f" +{len(unread) - 1} more" if len(unread) > 1 else ""
        message = f"AgriLink: {top.title}.{extra} Open the app for details."

        if send_sms(user.phone, message):
            user.sms_digest_sent_at = now
            sent += 1

    if sent:
        db.commit()
        logger.info("send_sms_digests: %d digest(s) sent", sent)
    return sent
