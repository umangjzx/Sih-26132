"""Per-user transaction history (Phase 3, D-08).

GET /api/history returns the caller's lots, demands, and deals in one payload:
  - Farmer: own lots, [] demands, own deals.
  - Buyer:  [] lots, own demands, own deals.
  - Admin:  all lots, all demands, all deals.

Deals are assembled into DealDetailResponse the same way as in deals.py, reusing
the summary helpers from api/matching.py.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deals import _assemble_detail
from app.core.database import get_db
from app.core.security import CurrentUser
from app.models.deal import Deal
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.schemas.deal import HistoryResponse
from app.schemas.demand import DemandResponse
from app.schemas.lot import LotResponse

router = APIRouter(tags=["history"])


@router.get("/api/history", response_model=HistoryResponse)
def get_my_history(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> HistoryResponse:
    role = current_user.role

    # --- lots ---
    lot_stmt = select(Lot).order_by(Lot.id.desc())
    if role == "farmer":
        lot_stmt = lot_stmt.where(Lot.farmer_id == current_user.id)
    elif role == "buyer":
        lot_stmt = lot_stmt.where(Lot.id == None)  # noqa: E711 — force empty for buyers
    lots = list(db.execute(lot_stmt).scalars().all())

    # --- demands ---
    demand_stmt = select(Demand).order_by(Demand.id.desc())
    if role == "buyer":
        demand_stmt = demand_stmt.where(Demand.buyer_id == current_user.id)
    elif role == "farmer":
        demand_stmt = demand_stmt.where(Demand.id == None)  # noqa: E711
    demands = list(db.execute(demand_stmt).scalars().all())

    # --- deals ---
    deal_stmt = (
        select(Deal, Lot, Demand)
        .join(Match, Deal.match_id == Match.id)
        .join(Lot, Match.lot_id == Lot.id)
        .join(Demand, Match.demand_id == Demand.id)
        .order_by(Deal.created_at.desc(), Deal.id.desc())
    )
    if role == "farmer":
        deal_stmt = deal_stmt.where(Lot.farmer_id == current_user.id)
    elif role == "buyer":
        deal_stmt = deal_stmt.where(Demand.buyer_id == current_user.id)
    deal_rows = db.execute(deal_stmt).all()

    return HistoryResponse(
        lots=[LotResponse.model_validate(lot) for lot in lots],
        demands=[DemandResponse.model_validate(d) for d in demands],
        deals=[
            _assemble_detail(deal, lot, demand, current_user, db)
            for deal, lot, demand in deal_rows
        ],
    )
