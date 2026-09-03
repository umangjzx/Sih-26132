"""Price alerts + in-app notifications (v1.1). All routes require a logged-in user."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser
from app.models.notification import Notification
from app.models.price_alert import PriceAlert
from app.schemas.alert import (
    NotificationResponse,
    PriceAlertCreate,
    PriceAlertResponse,
)

router = APIRouter(prefix="/api", tags=["alerts"])

_MAX_ALERTS_PER_USER = 50


# ---- price alerts -------------------------------------------------------- #

@router.post("/alerts", response_model=PriceAlertResponse, status_code=201)
def create_alert(
    body: PriceAlertCreate,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> PriceAlert:
    crop, market = body.crop.strip(), body.market.strip()

    count = db.execute(
        select(func.count()).select_from(PriceAlert)
        .where(PriceAlert.user_id == current_user.id)
    ).scalar_one()
    if count >= _MAX_ALERTS_PER_USER:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"You already have {_MAX_ALERTS_PER_USER} alerts — delete one first.",
        )

    dup = db.execute(
        select(PriceAlert).where(
            PriceAlert.user_id == current_user.id,
            PriceAlert.crop.ilike(crop),
            PriceAlert.market.ilike(market),
            PriceAlert.direction == body.direction,
            PriceAlert.threshold == body.threshold,
        )
    ).scalars().first()
    if dup is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "You already have this exact alert.")

    alert = PriceAlert(
        user_id=current_user.id,
        crop=crop,
        market=market,
        direction=body.direction,
        threshold=body.threshold,
        active=True,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.get("/alerts", response_model=list[PriceAlertResponse])
def my_alerts(current_user: CurrentUser, db: Session = Depends(get_db)) -> list[PriceAlert]:
    return list(
        db.execute(
            select(PriceAlert)
            .where(PriceAlert.user_id == current_user.id)
            .order_by(PriceAlert.created_at.desc(), PriceAlert.id.desc())
        ).scalars().all()
    )


def _owned_alert(alert_id: int, user_id: int, db: Session) -> PriceAlert:
    alert = db.get(PriceAlert, alert_id)
    if alert is None or alert.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return alert


@router.patch("/alerts/{alert_id}/toggle", response_model=PriceAlertResponse)
def toggle_alert(
    alert_id: int, current_user: CurrentUser, db: Session = Depends(get_db)
) -> PriceAlert:
    alert = _owned_alert(alert_id, current_user.id, db)
    alert.active = not alert.active
    db.commit()
    db.refresh(alert)
    return alert


@router.delete("/alerts/{alert_id}", status_code=204)
def delete_alert(
    alert_id: int, current_user: CurrentUser, db: Session = Depends(get_db)
) -> None:
    alert = _owned_alert(alert_id, current_user.id, db)
    db.delete(alert)
    db.commit()


# ---- notifications ----------------------------------------------------- #

@router.get("/notifications", response_model=list[NotificationResponse])
def my_notifications(
    current_user: CurrentUser,
    unread_only: bool = False,
    limit: int = Query(60, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[Notification]:
    stmt = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        stmt = stmt.where(Notification.read.is_(False))
    stmt = (
        stmt.order_by(Notification.read.asc(), Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
    )
    return list(db.execute(stmt).scalars().all())


@router.get("/notifications/unread-count")
def unread_count(current_user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    n = db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == current_user.id, Notification.read.is_(False))
    ).scalar_one()
    return {"unread": int(n)}


@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
def mark_read(
    notification_id: int, current_user: CurrentUser, db: Session = Depends(get_db)
) -> Notification:
    n = db.get(Notification, notification_id)
    if n is None or n.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    n.read = True
    db.commit()
    db.refresh(n)
    return n


@router.post("/notifications/read-all", status_code=204)
def mark_all_read(current_user: CurrentUser, db: Session = Depends(get_db)) -> None:
    db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read.is_(False))
        .values(read=True)
    )
    db.commit()
