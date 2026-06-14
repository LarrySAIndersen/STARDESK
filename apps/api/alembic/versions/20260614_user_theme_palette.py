"""Per-user theme palette preference (staff appearance).

Revision ID: 20260614_theme_palette
Revises: 20260612_team_chat
Create Date: 2026-06-14
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "20260614_theme_palette"
down_revision = "20260612_team_chat"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("theme_palette", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "theme_palette")
