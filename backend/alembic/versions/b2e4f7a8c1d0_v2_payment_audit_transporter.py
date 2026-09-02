"""Phase 2: deal_payments, transaction_events, transporters, logistics.pod_url

Revision ID: b2e4f7a8c1d0
Revises: a1b7c9d3e5f0
Create Date: 2026-09-02 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b2e4f7a8c1d0"
down_revision: Union[str, Sequence[str], None] = "a1b7c9d3e5f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- deal_payments -------------------------------------------------------
    op.create_table(
        "deal_payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("deal_id", sa.Integer(), nullable=False),
        sa.Column("payer_id", sa.Integer(), nullable=False),
        sa.Column("amount_inr", sa.Float(), nullable=False),
        sa.Column("method", sa.String(length=30), nullable=False, server_default="UPI"),
        sa.Column("reference", sa.String(length=160), nullable=True),
        sa.Column("note", sa.String(length=300), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["deal_id"], ["deals.id"], name=op.f("fk_deal_payments_deal_id_deals")),
        sa.ForeignKeyConstraint(["payer_id"], ["users.id"], name=op.f("fk_deal_payments_payer_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_deal_payments")),
    )
    op.create_index(op.f("ix_deal_payments_deal_id"), "deal_payments", ["deal_id"])

    # ---- transaction_events (audit log) -------------------------------------
    op.create_table(
        "transaction_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=True),        # null for system events
        sa.Column("entity_type", sa.String(length=30), nullable=False),  # deal|offer|dispute|payment|lot|demand
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=60), nullable=False),        # advance_to_paid, offer_accepted, ...
        sa.Column("detail", sa.String(length=500), nullable=True),        # JSON-encoded extra info
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], name=op.f("fk_tx_events_actor_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_transaction_events")),
    )
    op.create_index(op.f("ix_tx_events_entity"), "transaction_events", ["entity_type", "entity_id"])
    op.create_index(op.f("ix_tx_events_created_at"), "transaction_events", ["created_at"])

    # ---- transporters (curated directory) -----------------------------------
    op.create_table(
        "transporters",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("district", sa.String(length=120), nullable=True),
        sa.Column("state", sa.String(length=120), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
        sa.Column("vehicle_types", sa.String(length=200), nullable=True),   # CSV
        sa.Column("rate_per_km_per_qtl", sa.Float(), nullable=True),        # ₹/km/quintal
        sa.Column("max_capacity_tonnes", sa.Float(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_transporters")),
    )
    op.create_index(op.f("ix_transporters_district"), "transporters", ["district"])

    # ---- proof-of-delivery field on deal_logistics --------------------------
    op.add_column("deal_logistics", sa.Column("pod_url", sa.String(length=500), nullable=True))
    op.add_column("deal_logistics", sa.Column("pod_confirmed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("deal_logistics", "pod_confirmed_at")
    op.drop_column("deal_logistics", "pod_url")
    op.drop_index(op.f("ix_transporters_district"), table_name="transporters")
    op.drop_table("transporters")
    op.drop_index(op.f("ix_tx_events_created_at"), table_name="transaction_events")
    op.drop_index(op.f("ix_tx_events_entity"), table_name="transaction_events")
    op.drop_table("transaction_events")
    op.drop_index(op.f("ix_deal_payments_deal_id"), table_name="deal_payments")
    op.drop_table("deal_payments")
