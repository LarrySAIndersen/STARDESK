"""Chatbot messages table.

Revision ID: 20260605_chatbot_messages
Revises: 20260604_personal_workspace
Create Date: 2026-06-05
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260605_chatbot_messages"
down_revision = "20260604_personal_workspace"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chatbot_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("sender", sa.String(length=10), nullable=False),
        sa.Column("sender_name", sa.String(length=100), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=True),
        sa.Column("ticket_ref", sa.String(length=20), nullable=True),
        sa.Column("is_bookmarked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_chatbot_messages_user_id", "chatbot_messages", ["user_id"])
    op.create_index("idx_chatbot_messages_session_id", "chatbot_messages", ["session_id"])


def downgrade() -> None:
    op.drop_table("chatbot_messages")
