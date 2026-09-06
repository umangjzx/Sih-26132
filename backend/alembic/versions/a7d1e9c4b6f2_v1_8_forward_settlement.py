"""v1_8 forward contract settlement tracking

Revision ID: a7d1e9c4b6f2
Revises: f6c9d2e4a1b8
Create Date: 2026-09-04 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7d1e9c4b6f2"
down_revision: Union[str, Sequence[str], None] = "f6c9d2e4a1b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("forward_commitments", sa.Column("settlement_due", sa.Date(), nullable=True))
    op.add_column(
        "forward_commitments",
        sa.Column("settlement_reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("forward_commitments", "settlement_reminder_sent_at")
    op.drop_column("forward_commitments", "settlement_due")
