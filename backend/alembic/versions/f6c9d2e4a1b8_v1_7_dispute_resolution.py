"""v1_7 dispute resolution fields

Revision ID: f6c9d2e4a1b8
Revises: e5b3c8a2f1d0
Create Date: 2026-09-03 02:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f6c9d2e4a1b8"
down_revision: Union[str, Sequence[str], None] = "e5b3c8a2f1d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("disputes", sa.Column("evidence_url", sa.String(length=500), nullable=True))
    op.add_column("disputes", sa.Column("outcome", sa.String(length=30), nullable=True))
    op.add_column("disputes", sa.Column("resolution", sa.String(length=1000), nullable=True))
    op.add_column("disputes", sa.Column("resolved_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("disputes", sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True))
    # normalise the legacy terminal value
    op.execute("UPDATE disputes SET status = 'resolved' WHERE status = 'closed'")


def downgrade() -> None:
    op.drop_column("disputes", "resolved_at")
    op.drop_column("disputes", "resolved_by")
    op.drop_column("disputes", "resolution")
    op.drop_column("disputes", "outcome")
    op.drop_column("disputes", "evidence_url")
