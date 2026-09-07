"""OTP delivery for the forgot-password flow.

Optional, like the other free/keyless integrations in this app (weather, LLM):
``SMS_API_KEY`` (a Fast2SMS-compatible "quick SMS" key) sends a real text.
Blank -> the code is written to the server log instead of texted, so the reset
flow is still fully exercisable for a local/offline demo without a paid SMS
account (see README config table). Never raises — a delivery failure must not
break the request; the caller always returns its own generic response.
"""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_otp_sms(phone: str, otp: str) -> bool:
    """Best-effort OTP delivery. Returns whether it was actually sent."""
    message = f"{otp} is your AgriLink verification code. Valid for 10 minutes. Do not share it."
    if not settings.sms_api_key:
        logger.warning(
            "[AgriLink] SMS_API_KEY not set — password-reset code for ***%s: %s "
            "(dev-only log; configure SMS_API_KEY to send a real text instead)",
            phone[-4:], otp,
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
    except Exception as exc:  # noqa: BLE001 - delivery must never break the request
        logger.warning("SMS send failed for ***%s (%s)", phone[-4:], exc)
        return False
