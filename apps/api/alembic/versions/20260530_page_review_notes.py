"""Page review sticky notes + stardesk_reviewer role.

Revision ID: 20260530_page_review_notes
Revises: 20260530_workboard_tasks
Create Date: 2026-05-30
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260530_page_review_notes"
down_revision = "20260530_workboard_tasks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check")
    op.execute(
        """
        ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN (
            'end_user', 'agent', 'admin', 'top_admin', 'supporter', 'stardesk_reviewer'
        ))
        """
    )

    op.create_table(
        "page_review_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("page_path", sa.String(length=512), nullable=False),
        sa.Column("page_title", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("position_x", sa.Float(), nullable=False),
        sa.Column("position_y", sa.Float(), nullable=False),
        sa.Column("position_selector", sa.String(length=512), nullable=True),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_page_review_notes_page_path",
        "page_review_notes",
        ["page_path"],
    )
    op.create_index(
        "idx_page_review_notes_status",
        "page_review_notes",
        ["status"],
    )
    op.create_index(
        "idx_page_review_notes_created_by",
        "page_review_notes",
        ["created_by_user_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_page_review_notes_created_by", table_name="page_review_notes")
    op.drop_index("idx_page_review_notes_status", table_name="page_review_notes")
    op.drop_index("idx_page_review_notes_page_path", table_name="page_review_notes")
    op.drop_table("page_review_notes")

    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check")
    op.execute(
        """
        ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('end_user', 'agent', 'admin', 'top_admin', 'supporter'))
        """
    )
    op.execute("UPDATE users SET role = 'agent' WHERE role = 'stardesk_reviewer'")
