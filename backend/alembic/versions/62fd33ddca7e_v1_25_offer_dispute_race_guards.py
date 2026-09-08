"""v1_25 unique constraints closing the offer/dispute insert races

offers: a partial UNIQUE(match_id) WHERE status = 'pending' — post_offer
always supersedes every existing pending offer on a match before inserting
a new one, so at most one pending offer should ever exist per match. A
double-submit, or both parties posting at the same instant, could race past
that in-Python supersede-then-insert sequence and leave two.

disputes: a partial UNIQUE(deal_id) WHERE status = 'open' — raise_dispute
enforces "only one open dispute per deal" in Python; this backs it at the
DB level. Resolved/withdrawn rows stay allowed so a deal keeps its full
dispute history across multiple raised-and-resolved rounds.

Found via a systematic grep for the same check-then-insert shape after
fixing the identical bug in pools/forward/financing (see
concurrency-atomic-claims memory) — not from a reported symptom.

Revision ID: 62fd33ddca7e
Revises: d730f5bc2c6d
Create Date: 2026-09-08 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "62fd33ddca7e"
down_revision: Union[str, Sequence[str], None] = "d730f5bc2c6d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_offer_pending_per_match",
        "offers",
        ["match_id"],
        unique=True,
        postgresql_where="status = 'pending'",
        sqlite_where="status = 'pending'",
    )
    op.create_index(
        "uq_dispute_open_per_deal",
        "disputes",
        ["deal_id"],
        unique=True,
        postgresql_where="status = 'open'",
        sqlite_where="status = 'open'",
    )


def downgrade() -> None:
    op.drop_index("uq_dispute_open_per_deal", table_name="disputes")
    op.drop_index("uq_offer_pending_per_match", table_name="offers")
