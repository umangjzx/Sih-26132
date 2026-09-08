"""v1_27 unique constraint closing the match-upsert insert race

matches: UNIQUE(lot_id, demand_id) — both _score_and_upsert (background
auto-matcher) and try_pair (the "express interest" buttons on the discovery
boards) check-then-insert keyed on this pair, with an established invariant
that a Match already in a terminal-ish status (accepted/rejected) is never
superseded by a new row for the same pair — only a proposed/offered one is
ever updated in place. A double-submit (multi-tab "express interest" click,
or a manual rematch racing an express-interest call) could otherwise insert
two rows for the same pair.

Revision ID: cc8b832e753a
Revises: 9a5917ab05cd
Create Date: 2026-09-08 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "cc8b832e753a"
down_revision: Union[str, Sequence[str], None] = "9a5917ab05cd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_match_lot_demand", "matches", ["lot_id", "demand_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_match_lot_demand", "matches", type_="unique")
