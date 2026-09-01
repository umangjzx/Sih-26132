"""Matching endpoints: list matches for the current user."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser
from app.models.demand import Demand
from app.models.lot import Lot
from app.models.match import Match
from app.models.user import User
from app.schemas.match import CounterpartySummary, DemandSummary, LotSummary, MatchResponse

router = APIRouter(prefix="/api/matches", tags=["matching"])


def _lot_summary(lot: Lot) -> LotSummary:
    return LotSummary(
        id=lot.id,
        farmer_id=lot.farmer_id,
        crop=lot.crop,
        quantity_kg=lot.quantity_kg,
        quality_grade=lot.quality_grade,
        expected_price=lot.expected_price,
        location=lot.location,
        status=lot.status,
    )


def _demand_summary(demand: Demand) -> DemandSummary:
    return DemandSummary(
        id=demand.id,
        crop=demand.crop,
        quantity_kg=demand.quantity_kg,
        price_band_min=demand.price_band_min,
        price_band_max=demand.price_band_max,
        delivery_window=demand.delivery_window,
        status=demand.status,
    )


def _counterparty(user: User) -> CounterpartySummary:
    return CounterpartySummary(
        id=user.id,
        name=user.name,
        district=user.district,
        kyc_status=user.kyc_status,
    )


@router.get("/mine", response_model=list[MatchResponse])
def list_my_matches(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> list[MatchResponse]:
    """Return ranked matches for the current user.

    Farmers see matches where their lot is involved; buyers see matches where
    their demand is involved. Rejected matches are excluded. Results ordered
    by score descending.
    """
    results: list[MatchResponse] = []

    if current_user.role == "farmer":
        rows = db.execute(
            select(Match, Lot, Demand, User)
            .join(Lot, Match.lot_id == Lot.id)
            .join(Demand, Match.demand_id == Demand.id)
            .join(User, Demand.buyer_id == User.id)
            .where(
                Lot.farmer_id == current_user.id,
                Match.status != "rejected",
            )
            .order_by(Match.score.desc())
        ).all()

        for match, lot, demand, buyer in rows:
            results.append(MatchResponse(
                id=match.id,
                lot=_lot_summary(lot),
                demand=_demand_summary(demand),
                score=match.score,
                score_detail=match.score_detail,
                status=match.status,
                counterparty=_counterparty(buyer),
            ))

    elif current_user.role == "buyer":
        rows = db.execute(
            select(Match, Lot, Demand, User)
            .join(Demand, Match.demand_id == Demand.id)
            .join(Lot, Match.lot_id == Lot.id)
            .join(User, Lot.farmer_id == User.id)
            .where(
                Demand.buyer_id == current_user.id,
                Match.status != "rejected",
            )
            .order_by(Match.score.desc())
        ).all()

        for match, lot, demand, farmer in rows:
            results.append(MatchResponse(
                id=match.id,
                lot=_lot_summary(lot),
                demand=_demand_summary(demand),
                score=match.score,
                score_detail=match.score_detail,
                status=match.status,
                counterparty=_counterparty(farmer),
            ))

    else:
        # Admin or unknown role — no matches
        pass

    return results


@router.get("/{match_id}", response_model=MatchResponse)
def get_match(
    match_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> MatchResponse:
    """Return a single match by id.

    Only accessible by the farmer of the lot or the buyer of the demand.
    """
    row = db.execute(
        select(Match, Lot, Demand)
        .join(Lot, Match.lot_id == Lot.id)
        .join(Demand, Match.demand_id == Demand.id)
        .where(Match.id == match_id)
    ).first()

    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    match, lot, demand = row

    is_farmer = lot.farmer_id == current_user.id
    is_buyer = demand.buyer_id == current_user.id
    if not is_farmer and not is_buyer:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Fetch counterparty
    if is_farmer:
        cp_user = db.execute(select(User).where(User.id == demand.buyer_id)).scalar_one_or_none()
    else:
        cp_user = db.execute(select(User).where(User.id == lot.farmer_id)).scalar_one_or_none()

    return MatchResponse(
        id=match.id,
        lot=_lot_summary(lot),
        demand=_demand_summary(demand),
        score=match.score,
        score_detail=match.score_detail,
        status=match.status,
        counterparty=_counterparty(cp_user) if cp_user else None,
    )
