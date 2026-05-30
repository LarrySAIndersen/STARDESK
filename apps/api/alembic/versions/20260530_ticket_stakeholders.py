"""Ticket stakeholders and entity relationship graph.

Revision ID: 20260530_ticket_stakeholders
Revises: 20260524_sla_settings
Create Date: 2026-05-30
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260530_ticket_stakeholders"
down_revision = "20260524_sla_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ticket_stakeholders",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_ticket_stakeholders_ticket",
        "ticket_stakeholders",
        ["ticket_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_ticket_stakeholders_user",
        "ticket_stakeholders",
        ["user_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "uq_ticket_stakeholders_active",
        "ticket_stakeholders",
        ["ticket_id", "user_id", "role"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL AND user_id IS NOT NULL"),
    )

    op.create_table(
        "entity_relationships",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_type", sa.String(length=32), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relationship_type", sa.String(length=64), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_entity_relationships_source",
        "entity_relationships",
        ["source_type", "source_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_entity_relationships_target",
        "entity_relationships",
        ["target_type", "target_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_entity_relationships_target", table_name="entity_relationships")
    op.drop_index("idx_entity_relationships_source", table_name="entity_relationships")
    op.drop_table("entity_relationships")
    op.drop_index("uq_ticket_stakeholders_active", table_name="ticket_stakeholders")
    op.drop_index("idx_ticket_stakeholders_user", table_name="ticket_stakeholders")
    op.drop_index("idx_ticket_stakeholders_ticket", table_name="ticket_stakeholders")
    op.drop_table("ticket_stakeholders")
