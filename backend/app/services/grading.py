"""Shared quality-grade rubric (v1.4).

A small, standard vocabulary so a lot's grade and a buyer's minimum grade are
comparable — instead of matching free text. ``A`` > ``B`` > ``C``; ``FAQ`` (Fair
Average Quality, a common Indian mandi term) sits at the ``B`` level.
"""

from __future__ import annotations

GRADES: list[dict] = [
    {"code": "A", "label": "Grade A",
     "desc": "Premium — clean, uniform size, no blemishes or moisture damage."},
    {"code": "B", "label": "Grade B",
     "desc": "Good — minor size variation, small share of blemished pieces."},
    {"code": "FAQ", "label": "FAQ",
     "desc": "Fair Average Quality — standard mandi acceptance, mixed sizing."},
    {"code": "C", "label": "Grade C",
     "desc": "Below average — visible defects, better suited for processing."},
]

GRADE_CODES: list[str] = [g["code"] for g in GRADES]

# rank used by matching.quality_factor (lower = better; FAQ ~ B)
GRADE_RANK: dict[str, int] = {"A": 0, "B": 1, "FAQ": 1, "C": 2, "D": 3}


def normalize_grade(value: str | None) -> str | None:
    """Map a free-text grade to a canonical code, or None if unrecognised."""
    if not value:
        return None
    t = value.strip().upper()
    if t in GRADE_RANK:
        return "FAQ" if t == "FAQ" else t
    for token in ("GRADE ", "GRADE-", "GRADE"):
        if t.startswith(token):
            rest = t[len(token):].strip()
            if rest in GRADE_RANK:
                return rest
    if "FAIR AVERAGE" in t or "FAQ" in t:
        return "FAQ"
    return None
