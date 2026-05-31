"""Kanban boards, members, and status-mapped columns.

Revision ID: 20260523_kanban
Revises: 20260521_ui_mode
Create Date: 2026-05-23
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260523_kanban"
down_revision = "20260521_ui_mode"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "kanban_boards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index(
        "idx_kanban_boards_team",
        "kanban_boards",
        ["team_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_kanban_boards_creator",
        "kanban_boards",
        ["created_by_user_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "kanban_board_members",
        sa.Column("board_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["board_id"], ["kanban_boards.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("board_id", "user_id"),
    )
    op.execute(
        """
        ALTER TABLE kanban_board_members ADD CONSTRAINT kanban_board_members_role_check
        CHECK (role IN ('owner', 'editor', 'viewer'))
        """
    )
    op.create_index("idx_kanban_board_members_user", "kanban_board_members", ["user_id"])

    op.create_table(
        "kanban_columns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("board_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("statuses", postgresql.ARRAY(sa.String(length=32)), nullable=False),
        sa.Column("default_status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["board_id"], ["kanban_boards.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_kanban_columns_board", "kanban_columns", ["board_id", "position"])


def downgrade() -> None:
    op.drop_index("idx_kanban_columns_board", table_name="kanban_columns")
    op.drop_table("kanban_columns")
    op.drop_index("idx_kanban_board_members_user", table_name="kanban_board_members")
    op.drop_table("kanban_board_members")
    op.drop_index("idx_kanban_boards_creator", table_name="kanban_boards")
    op.drop_index("idx_kanban_boards_team", table_name="kanban_boards")
    op.drop_table("kanban_boards")
