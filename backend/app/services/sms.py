"""SMS delivery — the forgot-password OTP and the optional update digest.

Optional, like the other free/keyless integrations in this app (weather, LLM):
``SMS_API_KEY`` (a Fast2SMS-compatible "quick SMS" key) sends a real text.
Blank -> the message is written to the server log instead of texted, so both
callers stay fully exercisable for a local/offline demo without a paid SMS
account (see README config table). Never raises — a delivery failure must not
break the caller; every function here returns whether it actually sent.
"""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_sms(phone: str, message: str) -> bool:
    """Best-effort delivery of an arbitrary short message. Returns whether it
    was actually sent (vs. logged because no key is configured, or failed)."""
    if not settings.sms_api_key:
        logger.warning(
            "[AgriLink] SMS_API_KEY not set — message for ***%s not sent: %s "
            "(dev-only log; configure SMS_API_KEY to send a real text instead)",
            phone[-4:], message,
        )
        return False
    try:
        digits = phone.lstrip("+")[-10:]
        with httpx.Client(timeout=6.0) as client:
            resp = client.post(
                settings.sms_api_url,
                headers={"authorization": settings.sms_api_key},
                data={
                    "route": "q",
                    "message": message,
                    "language": "english",
                    "flash": 0,
                    "numbers": digits,
                },
            )
            resp.raise_for_status()
        return True
    except Exception as exc:  # noqa: BLE001 - delivery must never break the caller
        logger.warning("SMS send failed for ***%s (%s)", phone[-4:], exc)
        return False


def send_otp_sms(phone: str, otp: str) -> bool:
    """Best-effort OTP delivery for the forgot-password flow."""
    message = f"{otp} is your AgriLink verification code. Valid for 10 minutes. Do not share it."
    return send_sms(phone, message)
