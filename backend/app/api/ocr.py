"""OCR assist (v1.3): read a photographed mandi slip or a handwritten lot note
and pre-fill the "List a Lot" form.

The extracted fields are a *draft* — the farmer reviews and edits every value
before the lot is created, so a wrong read is never silently trusted. The route
degrades to ``{"available": false}`` without an OpenRouter key.
"""

import base64
import json
import re
from datetime import date
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.security import require_role
from app.services import llm

router = APIRouter(prefix="/api/ocr", tags=["ocr"])

_MAX_BYTES = 6 * 1024 * 1024
_OK_TYPES = {"image/jpeg", "image/png", "image/webp"}

_SYS = (
    "You read a single photo of an Indian agricultural mandi slip, sale receipt, "
    "or a farmer's handwritten note about a crop lot. Extract ONLY what is "
    "clearly written. Reply with a compact JSON object and nothing else, using "
    "these keys (omit any you cannot read — never guess):\n"
    '  "crop"          - commodity name in English, singular, Title Case\n'
    '  "quantity_kg"   - number, converted to kilograms (1 quintal = 100 kg, 1 bag ~ 50 kg only if the slip says so)\n'
    '  "grade"         - one of "A","B","C","FAQ" if a grade/quality is written\n'
    '  "expected_price"- number, rupees per quintal (₹/qtl); if the slip is ₹/kg multiply by 100\n'
    '  "available_from"- ISO date YYYY-MM-DD if a date is written\n'
    '  "confidence"    - your overall read confidence 0..1\n'
    "Do not add commentary, markdown, or a code fence."
)


class OcrLotDraft(BaseModel):
    available: bool
    crop: str | None = None
    quantity_kg: float | None = None
    grade: str | None = None
    expected_price: float | None = None
    available_from: date | None = None
    confidence: float | None = None
    note: str | None = None


def _num(v: object) -> float | None:
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        m = re.search(r"-?\d[\d,]*\.?\d*", v)
        if m:
            try:
                return float(m.group(0).replace(",", ""))
            except ValueError:
                return None
    return None


def _parse(raw: str) -> dict:
    """Pull the JSON object out of the model reply, tolerating a stray fence."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        raw = raw[raw.find("{"): raw.rfind("}") + 1]
    else:
        a, b = raw.find("{"), raw.rfind("}")
        if a != -1 and b != -1:
            raw = raw[a: b + 1]
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return {}


@router.post("/lot-slip", response_model=OcrLotDraft)
async def read_lot_slip(
    file: UploadFile = File(...),
    _role: Annotated[None, require_role("farmer")] = None,
) -> OcrLotDraft:
    if not llm.available():
        return OcrLotDraft(available=False, note="OCR assist is not configured on this server.")

    if file.content_type not in _OK_TYPES:
        raise HTTPException(415, "Upload a JPEG, PNG, or WebP photo.")
    blob = await file.read()
    if not blob:
        raise HTTPException(400, "The uploaded file is empty.")
    if len(blob) > _MAX_BYTES:
        raise HTTPException(413, "Photo is larger than 6 MB — please compress it.")

    data_url = f"data:{file.content_type};base64,{base64.b64encode(blob).decode()}"
    reply = llm.vision(_SYS, "Extract the lot details from this slip.", data_url)
    if not reply:
        return OcrLotDraft(available=False, note="Could not read the photo. Enter the details by hand.")

    obj = _parse(reply)
    crop = obj.get("crop")
    if isinstance(crop, str):
        crop = crop.strip().title() or None

    grade = obj.get("grade")
    if isinstance(grade, str):
        g = grade.strip().upper()
        grade = g if g in {"A", "B", "C", "D", "FAQ"} else None
    else:
        grade = None

    af = obj.get("available_from")
    parsed_date: date | None = None
    if isinstance(af, str):
        try:
            parsed_date = date.fromisoformat(af.strip()[:10])
        except ValueError:
            parsed_date = None

    qty = _num(obj.get("quantity_kg"))
    price = _num(obj.get("expected_price"))
    conf = _num(obj.get("confidence"))
    if conf is not None:
        conf = max(0.0, min(1.0, conf))

    got_any = any(v is not None for v in (crop, qty, grade, price, parsed_date))
    return OcrLotDraft(
        available=got_any,
        crop=crop,
        quantity_kg=qty if qty and qty > 0 else None,
        grade=grade,
        expected_price=price if price and price > 0 else None,
        available_from=parsed_date,
        confidence=conf,
        note=None if got_any else "Nothing readable was found. Enter the details by hand.",
    )
