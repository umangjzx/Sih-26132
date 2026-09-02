"""v1_4 pool -> deal handoff link

Revision ID: c3f8a1d6b204
Revises: b2e4f7a8c1d0
Create Date: 2026-09-02 13:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c3f8a1d6b204"
down_revision: Union[str, Sequence[str], None] = "b2e4f7a8c1d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("pools", sa.Column("matched_deal_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        op.f("fk_pools_matched_deal_id_deals"), "pools", "deals",
        ["matched_deal_id"], ["id"],
    )
    # plain int (no FK) — a FK here would close a pools->deals->matches->lots->pools cycle
    op.add_column("lots", sa.Column("pool_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("lots", "pool_id")
    op.drop_constraint(op.f("fk_pools_matched_deal_id_deals"), "pools", type_="foreignkey")
    op.drop_column("pools", "matched_deal_id")
