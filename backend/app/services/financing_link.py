"""Stamp a newly-created Deal back onto any active financing request against
the same lot (v1.20).

Before this, a financed lot's downstream deal was only discoverable by
walking Deal -> Match -> Lot and comparing lot_id by hand — the financing
record itself carried no trace of what happened to the collateral. Most lots
never have a financing request, so this is a no-op in the common case.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.financing import FinancingRequest

_ACTIVE_STATUSES = ("pending", "approved")


def link_financing_request_to_deal(db: Session, lot_id: int, deal_id: int) -> None:
    req = db.execute(
        select(FinancingRequest).where(
            FinancingRequest.lot_id == lot_id,
            FinancingRequest.status.in_(_ACTIVE_STATUSES),
            FinancingRequest.deal_id.is_(None),
        )
    ).scalar_one_or_none()
    if req is not None:
        req.deal_id = deal_id
