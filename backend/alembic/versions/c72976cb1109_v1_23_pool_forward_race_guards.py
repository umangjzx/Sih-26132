"""v1_23 unique constraints closing the pool/forward-commitment insert races

pool_members: a plain UNIQUE(pool_id, farmer_id) — join_pool always upserts by
this pair, so two rows for one farmer in one pool should never exist.

forward_commitments: a partial UNIQUE(bid_id, farmer_id) WHERE status IN
('pending', 'accepted') — a farmer may hold only one *active* commitment per
bid at a time, but past withdrawn/declined rows must stay allowed so a farmer
can re-commit after withdrawing.

Both back an app-level check-then-insert that a double-submit (multi-tab,
retried request) could otherwise race past — see app/api/pools.py join_pool
and app/api/forward.py commit_to_bid.

Revision ID: c72976cb1109
Revises: a3d7f0b2e5c9
Create Date: 2026-09-08 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "c72976cb1109"
down_revision: Union[str, Sequence[str], None] = "a3d7f0b2e5c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_pool_member_pool_farmer", "pool_members", ["pool_id", "farmer_id"],
    )
    op.create_index(
        "uq_forward_commitment_active_per_farmer_bid",
        "forward_commitments",
        ["bid_id", "farmer_id"],
        unique=True,
        postgresql_where="status IN ('pending', 'accepted')",
        sqlite_where="status IN ('pending', 'accepted')",
    )


def downgrade() -> None:
    op.drop_index("uq_forward_commitment_active_per_farmer_bid", table_name="forward_commitments")
    op.drop_constraint("uq_pool_member_pool_farmer", "pool_members", type_="unique")
