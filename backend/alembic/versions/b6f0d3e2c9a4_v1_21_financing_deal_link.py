"""v1_21 link a financing request to its downstream deal

Revision ID: b6f0d3e2c9a4
Revises: e7f2a9c3b6d5
Create Date: 2026-09-07 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b6f0d3e2c9a4"
down_revision: Union[str, Sequence[str], None] = "e7f2a9c3b6d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("financing_requests", sa.Column("deal_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_financing_requests_deal_id"), "financing_requests", ["deal_id"])
    op.create_foreign_key(
        op.f("fk_financing_requests_deal_id_deals"),
        "financing_requests", "deals", ["deal_id"], ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_financing_requests_deal_id_deals"), "financing_requests", type_="foreignkey")
    op.drop_index(op.f("ix_financing_requests_deal_id"), table_name="financing_requests")
    op.drop_column("financing_requests", "deal_id")
