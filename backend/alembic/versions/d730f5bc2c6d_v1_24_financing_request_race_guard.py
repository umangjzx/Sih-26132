"""v1_24 unique constraint closing the financing-request insert race

financing_requests: a partial UNIQUE(lot_id) WHERE status IN ('pending',
'approved') — a lot may hold only one *active* financing request at a time,
but past rejected/withdrawn rows must stay allowed so a farmer can request
again after either outcome.

Backs an app-level check-then-insert (create_request in app/api/financing.py)
that a double-submit (multi-tab, retried request) could otherwise race past,
letting the same lot be pledged as collateral twice.

Revision ID: d730f5bc2c6d
Revises: c72976cb1109
Create Date: 2026-09-08 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "d730f5bc2c6d"
down_revision: Union[str, Sequence[str], None] = "c72976cb1109"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_financing_request_active_per_lot",
        "financing_requests",
        ["lot_id"],
        unique=True,
        postgresql_where="status IN ('pending', 'approved')",
        sqlite_where="status IN ('pending', 'approved')",
    )


def downgrade() -> None:
    op.drop_index("uq_financing_request_active_per_lot", table_name="financing_requests")
