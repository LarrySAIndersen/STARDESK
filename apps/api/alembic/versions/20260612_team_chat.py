"""Team chat workspace tables.

Revision ID: 20260612_team_chat
Revises: 20260612_login_throttle
Create Date: 2026-06-12
"""

from pathlib import Path

from alembic import op

revision = "20260612_team_chat"
down_revision = "20260612_login_throttle"
branch_labels = None
depends_on = None

_SQL = (
    Path(__file__).resolve().parents[2]
    / "src"
    / "star_itsm_api"
    / "sql"
    / "migrations"
    / "38_team-chat.sql"
).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_SQL)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS team_chat_message_reactions CASCADE")
    op.execute("DROP TABLE IF EXISTS team_chat_messages CASCADE")
    op.execute("DROP TABLE IF EXISTS team_chat_channel_members CASCADE")
    op.execute("DROP TABLE IF EXISTS team_chat_channels CASCADE")
