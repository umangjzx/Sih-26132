"""v1_14 SMS digest opt-in

Revision ID: d3e6a8b1c4f7
Revises: c8a4f2b7d9e1
Create Date: 2026-09-07 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d3e6a8b1c4f7"
down_revision: Union[str, Sequence[str], None] = "c8a4f2b7d9e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("sms_digest_enabled", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "users",
        sa.Column("sms_digest_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "sms_digest_sent_at")
    op.drop_column("users", "sms_digest_enabled")
