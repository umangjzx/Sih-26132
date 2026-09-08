"""v1_22 add matches.created_at (staleness / risk indicator)

Revision ID: a3d7f0b2e5c9
Revises: b6f0d3e2c9a4
Create Date: 2026-09-08 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a3d7f0b2e5c9"
down_revision: Union[str, Sequence[str], None] = "b6f0d3e2c9a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "matches",
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("matches", "created_at")
