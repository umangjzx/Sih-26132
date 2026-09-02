"""v1_6 forward contracts (forward_bids + forward_commitments)

Revision ID: e5b3c8a2f1d0
Revises: d4a2e9c17b30
Create Date: 2026-09-02 18:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e5b3c8a2f1d0"
down_revision: Union[str, Sequence[str], None] = "d4a2e9c17b30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "forward_bids",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("buyer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("crop", sa.String(length=120), nullable=False, index=True),
        sa.Column("quantity_kg", sa.Float(), nullable=False),
        sa.Column("price_min", sa.Float(), nullable=False),
        sa.Column("price_max", sa.Float(), nullable=False),
        sa.Column("delivery_from", sa.Date(), nullable=False),
        sa.Column("delivery_to", sa.Date(), nullable=False),
        sa.Column("delivery_district", sa.String(length=120), server_default="", nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("quality_grade_min", sa.String(length=10), nullable=True),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="open", nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "forward_commitments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("bid_id", sa.Integer(), sa.ForeignKey("forward_bids.id"), nullable=False, index=True),
        sa.Column("farmer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("quantity_kg", sa.Float(), nullable=False),
        sa.Column("price_per_qtl", sa.Float(), nullable=False),
        sa.Column("expected_ready", sa.Date(), nullable=False),
        sa.Column("note", sa.String(length=1000), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False, index=True),
        sa.Column("deal_id", sa.Integer(), sa.ForeignKey("deals.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("forward_commitments")
    op.drop_table("forward_bids")
