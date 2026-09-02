"""v1_4 identity location + verification, demand delivery location

Revision ID: 9a3f1c05e7b2
Revises: 8d2f6b3a1c40
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9a3f1c05e7b2"
down_revision: Union[str, Sequence[str], None] = "8d2f6b3a1c40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("state", sa.String(length=120), nullable=False, server_default=""))
    op.add_column("users", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("longitude", sa.Float(), nullable=True))
    op.add_column(
        "users",
        sa.Column("verification_status", sa.String(length=20), nullable=False, server_default="unverified"),
    )
    op.add_column("users", sa.Column("verification_note", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("verification_ref", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("verified_by", sa.Integer(), nullable=True))
    # keep the legacy kyc_status badge in sync with any pre-set verified users
    op.execute("UPDATE users SET verification_status = 'verified' WHERE kyc_status = 'verified'")

    op.add_column(
        "demands",
        sa.Column("delivery_district", sa.String(length=120), nullable=False, server_default=""),
    )
    op.add_column("demands", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("demands", sa.Column("longitude", sa.Float(), nullable=True))

    op.add_column("deals", sa.Column("payment_method", sa.String(length=40), nullable=True))
    op.add_column("deals", sa.Column("payment_reference", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("deals", "payment_reference")
    op.drop_column("deals", "payment_method")
    op.drop_column("demands", "longitude")
    op.drop_column("demands", "latitude")
    op.drop_column("demands", "delivery_district")
    op.drop_column("users", "verified_by")
    op.drop_column("users", "verified_at")
    op.drop_column("users", "verification_ref")
    op.drop_column("users", "verification_note")
    op.drop_column("users", "verification_status")
    op.drop_column("users", "longitude")
    op.drop_column("users", "latitude")
    op.drop_column("users", "state")
