"""v1_9 lot photo storage (base64 data URL)

Revision ID: b3f8e1a9c5d2
Revises: a7d1e9c4b6f2
Create Date: 2026-09-06 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b3f8e1a9c5d2"
down_revision: Union[str, Sequence[str], None] = "a7d1e9c4b6f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # lots.photo_url was a short http(s) URL (varchar 500); it now also carries
    # a `data:image/...;base64,...` photo captured straight from the farmer's
    # scan/camera flow, which is far longer than any URL.
    op.alter_column(
        "lots", "photo_url",
        existing_type=sa.String(length=500),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "lots", "photo_url",
        existing_type=sa.Text(),
        type_=sa.String(length=500),
        existing_nullable=True,
    )
