"""Thin OpenRouter client (v1.3).

The LLM is a *readability layer*, never a source of truth: it rephrases the
rule-based signal in plain language, answers questions strictly from the data
we hand it, and translates short live strings. Every call degrades to None on a
missing key / network failure, and callers fall back to the rule output.
"""

import hashlib
import json
import logging
import time

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_CACHE: dict[str, tuple[float, str]] = {}
_TTL = 6 * 3600
_LANG = {"en": "English", "hi": "Hindi", "mr": "Marathi"}


def available() -> bool:
    return bool(settings.openrouter_api_key)


def lang_name(code: str) -> str:
    return _LANG.get((code or "en").lower(), "English")


def _key(system: str, user: str) -> str:
    h = hashlib.sha256(f"{settings.openrouter_model}\n{system}\n{user}".encode()).hexdigest()
    return h[:32]


def chat(
    system: str,
    user: str,
    *,
    max_tokens: int = 320,
    temperature: float = 0.3,
    cache: bool = True,
) -> str | None:
    """One-shot chat completion. Returns the assistant text, or None on any
    failure (no key, network, bad response). Cached by prompt for `_TTL`."""
    if not settings.openrouter_api_key:
        return None

    ck = _key(system, user)
    if cache:
        hit = _CACHE.get(ck)
        if hit and time.time() - hit[0] < _TTL:
            return hit[1]

    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                settings.openrouter_url,
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "HTTP-Referer": "https://github.com/umangjzx/Sih-26132",
                    "X-Title": "AgriLink",
                    "Content-Type": "application/json",
                },
                content=json.dumps({
                    "model": settings.openrouter_model,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                }),
            )
            resp.raise_for_status()
            data = resp.json()
        text = (data["choices"][0]["message"]["content"] or "").strip()
    except Exception as exc:  # noqa: BLE001
        logger.warning("OpenRouter call failed (%s)", exc)
        return None

    if not text:
        return None
    if cache:
        _CACHE[ck] = (time.time(), text)
    return text


# --------------------------------------------------------------------------- #
# Vision — read a photographed mandi slip / handwritten lot note
# --------------------------------------------------------------------------- #

def vision(system: str, user: str, image_data_url: str, *, max_tokens: int = 400) -> str | None:
    """Single-image chat completion. `image_data_url` is a `data:image/...;base64,`
    string. Returns the assistant text or None on any failure. Not cached — every
    slip photo is unique."""
    if not settings.openrouter_api_key or not image_data_url:
        return None
    try:
        with httpx.Client(timeout=45.0) as client:
            resp = client.post(
                settings.openrouter_url,
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "HTTP-Referer": "https://github.com/umangjzx/Sih-26132",
                    "X-Title": "AgriLink",
                    "Content-Type": "application/json",
                },
                content=json.dumps({
                    "model": settings.openrouter_model,
                    "max_tokens": max_tokens,
                    "temperature": 0.0,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": [
                            {"type": "text", "text": user},
                            {"type": "image_url", "image_url": {"url": image_data_url}},
                        ]},
                    ],
                }),
            )
            resp.raise_for_status()
            data = resp.json()
        return (data["choices"][0]["message"]["content"] or "").strip() or None
    except Exception as exc:  # noqa: BLE001
        logger.warning("OpenRouter vision call failed (%s)", exc)
        return None


# --------------------------------------------------------------------------- #
# Translation of short live strings (weather conditions, API notes)
# --------------------------------------------------------------------------- #

def translate(text: str, lang: str) -> str:
    """Translate a short UI string. Returns the original on failure or when
    lang is English / the LLM is unavailable."""
    text = (text or "").strip()
    if not text or (lang or "en").lower() == "en" or not available():
        return text
    out = chat(
        f"Translate the given agricultural UI text to {lang_name(lang)}. "
        "Reply with ONLY the translation, no quotes, no notes. Keep numbers and units as-is.",
        text,
        max_tokens=120,
        temperature=0.0,
    )
    return out or text
