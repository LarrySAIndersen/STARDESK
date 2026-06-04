"""Personal notes and kanban cards per user.

Revision ID: 20260604_personal_workspace
Revises: 20260602_perf_benchmarks
Create Date: 2026-06-04
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260604_personal_workspace"
down_revision = "20260602_perf_benchmarks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "personal_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("color", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_personal_notes_user_id", "personal_notes", ["user_id"])

    op.create_table(
        "personal_kanban_cards",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "ticket_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tickets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("column_name", sa.String(length=64), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "ticket_id"),
    )
    op.create_index(
        "idx_personal_kanban_cards_user_column",
        "personal_kanban_cards",
        ["user_id", "column_name"],
    )


def downgrade() -> None:
    op.drop_index("idx_personal_kanban_cards_user_column", table_name="personal_kanban_cards")
    op.drop_table("personal_kanban_cards")
    op.drop_index("idx_personal_notes_user_id", table_name="personal_notes")
    op.drop_table("personal_notes")
