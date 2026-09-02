"""v1_3 group / pooled requests

Revision ID: 7c1e9a4b2d10
Revises: 566ce44b97a1
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7c1e9a4b2d10"
down_revision: Union[str, Sequence[str], None] = "566ce44b97a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pools",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organizer_id", sa.Integer(), nullable=False),
        sa.Column("crop", sa.String(length=120), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("target_quantity_kg", sa.Float(), nullable=False),
        sa.Column("floor_price", sa.Float(), nullable=False),
        sa.Column("grade", sa.String(length=50), nullable=False, server_default="B"),
        sa.Column("delivery_window", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("location", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organizer_id"], ["users.id"], name=op.f("fk_pools_organizer_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pools")),
    )
    op.create_index(op.f("ix_pools_crop"), "pools", ["crop"], unique=False)
    op.create_index(op.f("ix_pools_status"), "pools", ["status"], unique=False)

    op.create_table(
        "pool_members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pool_id", sa.Integer(), nullable=False),
        sa.Column("farmer_id", sa.Integer(), nullable=False),
        sa.Column("lot_id", sa.Integer(), nullable=True),
        sa.Column("quantity_kg", sa.Float(), nullable=False),
        sa.Column("expected_price", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="committed"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["pool_id"], ["pools.id"], name=op.f("fk_pool_members_pool_id_pools")),
        sa.ForeignKeyConstraint(["farmer_id"], ["users.id"], name=op.f("fk_pool_members_farmer_id_users")),
        sa.ForeignKeyConstraint(["lot_id"], ["lots.id"], name=op.f("fk_pool_members_lot_id_lots")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pool_members")),
    )
    op.create_index(op.f("ix_pool_members_pool_id"), "pool_members", ["pool_id"], unique=False)
    op.create_index(op.f("ix_pool_members_farmer_id"), "pool_members", ["farmer_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_pool_members_farmer_id"), table_name="pool_members")
    op.drop_index(op.f("ix_pool_members_pool_id"), table_name="pool_members")
    op.drop_table("pool_members")
    op.drop_index(op.f("ix_pools_status"), table_name="pools")
    op.drop_index(op.f("ix_pools_crop"), table_name="pools")
    op.drop_table("pools")
