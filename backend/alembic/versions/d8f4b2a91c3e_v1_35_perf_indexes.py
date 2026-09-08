"""v1_35 performance audit — add missing indexes on hot filter/sort/join columns

Found by a full backend/DB audit: lots.status and demands.status are filtered
on nearly every matching/discovery/admin query with no index at all (P0 —
the hottest predicates in the schema); deals.match_id, deals.pipeline_status,
deals.payment_status, deals.created_at, demands.buyer_id, lots.farmer_id,
matches.status, matches.demand_id, offers.match_id (unscoped — the existing
index only covers status='pending'), and disputes.deal_id (unscoped — the
existing index only covers status='open') are all filtered/sorted/joined on
in high-traffic paths with no supporting index (P1). Pure additive schema
change — no data migration, no application-code behavior change.

Revision ID: d8f4b2a91c3e
Revises: cc8b832e753a
Create Date: 2026-09-08 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "d8f4b2a91c3e"
down_revision: Union[str, Sequence[str], None] = "cc8b832e753a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INDEXES = [
    ("ix_lots_status", "lots", "status"),
    ("ix_lots_farmer_id", "lots", "farmer_id"),
    ("ix_demands_status", "demands", "status"),
    ("ix_demands_buyer_id", "demands", "buyer_id"),
    ("ix_deals_match_id", "deals", "match_id"),
    ("ix_deals_pipeline_status", "deals", "pipeline_status"),
    ("ix_deals_payment_status", "deals", "payment_status"),
    ("ix_deals_created_at", "deals", "created_at"),
    ("ix_matches_status", "matches", "status"),
    ("ix_matches_demand_id", "matches", "demand_id"),
    ("ix_offers_match_id", "offers", "match_id"),
    ("ix_disputes_deal_id", "disputes", "deal_id"),
]


def upgrade() -> None:
    for name, table, column in _INDEXES:
        op.create_index(name, table, [column])


def downgrade() -> None:
    for name, table, _column in reversed(_INDEXES):
        op.drop_index(name, table_name=table)
