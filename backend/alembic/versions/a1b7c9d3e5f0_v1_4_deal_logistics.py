"""v1_4 deal logistics

Revision ID: a1b7c9d3e5f0
Revises: 9a3f1c05e7b2
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b7c9d3e5f0"
down_revision: Union[str, Sequence[str], None] = "9a3f1c05e7b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "deal_logistics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("deal_id", sa.Integer(), nullable=False),
        sa.Column("mode", sa.String(length=30), nullable=False, server_default="hired_transport"),
        sa.Column("transporter_name", sa.String(length=160), nullable=True),
        sa.Column("transporter_phone", sa.String(length=20), nullable=True),
        sa.Column("vehicle_type", sa.String(length=40), nullable=True),
        sa.Column("pickup_date", sa.Date(), nullable=True),
        sa.Column("pickup_point", sa.String(length=200), nullable=True),
        sa.Column("drop_point", sa.String(length=200), nullable=True),
        sa.Column("distance_km", sa.Float(), nullable=True),
        sa.Column("est_cost_inr", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="planned"),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["deal_id"], ["deals.id"], name=op.f("fk_deal_logistics_deal_id_deals")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_deal_logistics")),
    )
    op.create_index(op.f("ix_deal_logistics_deal_id"), "deal_logistics", ["deal_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_deal_logistics_deal_id"), table_name="deal_logistics")
    op.drop_table("deal_logistics")
