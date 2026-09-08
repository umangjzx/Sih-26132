"""v1_37 add lots.photo_thumb_url — a genuinely small thumbnail alongside photo_url

Closes the last item deferred by the v1.35 performance audit: match/deal
list responses (GET /api/matches/mine, /api/deals/mine, /api/history) were
embedding the full compressed lot photo (photo_url, ~30-80 KB) even though
every UI that shows a counterparty's lot photo (buyer dashboard, match
thread) only ever renders it at 40-64px. LotSummary now exposes only this
new, genuinely tiny (~96px) thumbnail field instead. Existing lots keep
photo_url but have photo_thumb_url = NULL until next edited/re-saved — the
UI already handles "no photo" as a graceful fallback state, so this is a
one-time, non-breaking gap for pre-existing listings, not a crash.

Revision ID: a4d1e8c9f3b2
Revises: e2a6c4f7b1d9
Create Date: 2026-09-08 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a4d1e8c9f3b2"
down_revision: Union[str, Sequence[str], None] = "e2a6c4f7b1d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lots", sa.Column("photo_thumb_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("lots", "photo_thumb_url")
