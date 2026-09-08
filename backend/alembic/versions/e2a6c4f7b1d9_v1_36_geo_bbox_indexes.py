"""v1_36 add lat/lon composite indexes for discovery.py's bounding-box pre-filter

browse_lots/browse_demands' radius search now pre-filters candidates with a
lat/lon BETWEEN range in SQL before the precise haversine check in Python
(closing a "load every open lot/demand before geo-filtering" gap flagged in
the v1.35 performance audit). These composite indexes support that range
query. Pure additive schema change — no data migration.

Revision ID: e2a6c4f7b1d9
Revises: d8f4b2a91c3e
Create Date: 2026-09-08 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "e2a6c4f7b1d9"
down_revision: Union[str, Sequence[str], None] = "d8f4b2a91c3e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_lots_lat_lon", "lots", ["latitude", "longitude"])
    op.create_index("ix_demands_lat_lon", "demands", ["latitude", "longitude"])


def downgrade() -> None:
    op.drop_index("ix_demands_lat_lon", table_name="demands")
    op.drop_index("ix_lots_lat_lon", table_name="lots")
