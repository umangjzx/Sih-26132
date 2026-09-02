"""Thin helper to write TransactionEvent rows.

Every significant action (deal advance, offer create/accept/decline,
dispute raise/close, payment record, lot/demand create) should call
``log_event`` so there is a full, append-only ledger.

Import-time safe: only imports models inside functions so circular imports
are never an issue.
"""
from __future__ import annotations

import json
import logging

logger = logging.getLogger(__name__)


def log_event(
    db,
    *,
    actor_id: int | None,
    entity_type: str,
    entity_id: int,
    action: str,
    detail: dict | None = None,
) -> None:
    """Append one TransactionEvent row and flush (no commit — caller commits)."""
    from app.models.transaction_event import TransactionEvent

    evt = TransactionEvent(
        actor_id=actor_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        detail=json.dumps(detail, default=str) if detail else None,
    )
    db.add(evt)
    # We deliberately do NOT commit here — the calling endpoint owns the
    # transaction so the event and the mutation are atomic.
    logger.debug("audit: %s %s#%d by user=%s", action, entity_type, entity_id, actor_id)


def get_events_for(db, entity_type: str | list[str], entity_id: int) -> list[dict]:
    """Return all events for an entity (or several entity types that share the
    same id, e.g. a deal + its payments + its logistics), sorted oldest-first."""
    from sqlalchemy import select
    from app.models.transaction_event import TransactionEvent

    types = [entity_type] if isinstance(entity_type, str) else list(entity_type)
    rows = db.execute(
        select(TransactionEvent)
        .where(
            TransactionEvent.entity_type.in_(types),
            TransactionEvent.entity_id == entity_id,
        )
        .order_by(TransactionEvent.created_at.asc())
    ).scalars().all()

    return [
        {
            "id": r.id,
            "actor_id": r.actor_id,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "action": r.action,
            "detail": json.loads(r.detail) if r.detail else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
