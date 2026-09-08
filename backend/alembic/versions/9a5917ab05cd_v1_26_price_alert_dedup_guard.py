"""v1_26 functional unique index closing the price-alert insert race

price_alerts: UNIQUE(user_id, lower(crop), lower(market), direction,
threshold) — create_alert rejects an exact case-insensitive duplicate in
Python; a double-submit could race past that check and insert two, which
would just double-fire the same notification but is still worth closing.
A functional index on lower(crop)/lower(market) matches the case-insensitive
semantics of the existing check exactly (unlike a plain unique constraint,
which is case-sensitive and would miss a case-variant duplicate).

Revision ID: 9a5917ab05cd
Revises: 62fd33ddca7e
Create Date: 2026-09-08 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "9a5917ab05cd"
down_revision: Union[str, Sequence[str], None] = "62fd33ddca7e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_price_alert_dedup",
        "price_alerts",
        ["user_id", sa.text("lower(crop)"), sa.text("lower(market)"), "direction", "threshold"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_price_alert_dedup", table_name="price_alerts")
