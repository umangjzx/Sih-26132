"""v1_11 forward contract breach penalty

Revision ID: c8a4f2b7d9e1
Revises: b3f8e1a9c5d2
Create Date: 2026-09-07 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c8a4f2b7d9e1"
down_revision: Union[str, Sequence[str], None] = "b3f8e1a9c5d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("forward_commitments", sa.Column("breach_status", sa.String(20), nullable=True))
    op.add_column("forward_commitments", sa.Column("penalty_inr", sa.Float(), nullable=True))
    op.add_column(
        "forward_commitments",
        sa.Column("breached_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("forward_commitments", "breached_at")
    op.drop_column("forward_commitments", "penalty_inr")
    op.drop_column("forward_commitments", "breach_status")
