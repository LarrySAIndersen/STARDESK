"""Kanban explicit board membership and custom columns.

Revision ID: 20260523_kanban_v2
Revises: 20260523_kanban
Create Date: 2026-05-23
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260523_kanban_v2"
down_revision = "20260523_kanban"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "kanban_board_tickets",
        sa.Column("board_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("column_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["board_id"], ["kanban_boards.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["column_id"], ["kanban_columns.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("board_id", "ticket_id"),
    )
    op.create_index(
        "idx_kanban_board_tickets_column",
        "kanban_board_tickets",
        ["board_id", "column_id", "position"],
    )

    op.add_column(
        "kanban_columns",
        sa.Column("is_custom", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
    )
    op.add_column("kanban_columns", sa.Column("wip_limit", sa.SmallInteger(), nullable=True))
    op.alter_column("kanban_columns", "default_status", existing_type=sa.String(32), nullable=True)


def downgrade() -> None:
    op.alter_column("kanban_columns", "default_status", existing_type=sa.String(32), nullable=False)
    op.drop_column("kanban_columns", "wip_limit")
    op.drop_column("kanban_columns", "is_custom")
    op.drop_index("idx_kanban_board_tickets_column", table_name="kanban_board_tickets")
    op.drop_table("kanban_board_tickets")
