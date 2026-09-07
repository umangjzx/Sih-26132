"""v1_17 warehouse-receipt-backed financing requests

Revision ID: e7f2a9c3b6d5
Revises: d3e6a8b1c4f7
Create Date: 2026-09-07 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e7f2a9c3b6d5"
down_revision: Union[str, Sequence[str], None] = "d3e6a8b1c4f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "financing_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("farmer_id", sa.Integer(), nullable=False),
        sa.Column("lot_id", sa.Integer(), nullable=False),
        sa.Column("requested_amount_inr", sa.Float(), nullable=False),
        sa.Column("warehouse_name", sa.String(length=200), nullable=True),
        sa.Column("receipt_ref", sa.String(length=120), nullable=True),
        sa.Column("note", sa.String(length=1000), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("admin_note", sa.String(length=1000), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["farmer_id"], ["users.id"], name=op.f("fk_financing_requests_farmer_id_users")),
        sa.ForeignKeyConstraint(["lot_id"], ["lots.id"], name=op.f("fk_financing_requests_lot_id_lots")),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], name=op.f("fk_financing_requests_reviewed_by_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_financing_requests")),
    )
    op.create_index(op.f("ix_financing_requests_farmer_id"), "financing_requests", ["farmer_id"])
    op.create_index(op.f("ix_financing_requests_lot_id"), "financing_requests", ["lot_id"])
    op.create_index(op.f("ix_financing_requests_status"), "financing_requests", ["status"])


def downgrade() -> None:
    op.drop_index(op.f("ix_financing_requests_status"), table_name="financing_requests")
    op.drop_index(op.f("ix_financing_requests_lot_id"), table_name="financing_requests")
    op.drop_index(op.f("ix_financing_requests_farmer_id"), table_name="financing_requests")
    op.drop_table("financing_requests")
