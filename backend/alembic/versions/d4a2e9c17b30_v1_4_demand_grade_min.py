"""v1_4 demand.quality_grade_min

Revision ID: d4a2e9c17b30
Revises: c3f8a1d6b204
Create Date: 2026-09-02 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d4a2e9c17b30"
down_revision: Union[str, Sequence[str], None] = "c3f8a1d6b204"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("demands", sa.Column("quality_grade_min", sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column("demands", "quality_grade_min")
