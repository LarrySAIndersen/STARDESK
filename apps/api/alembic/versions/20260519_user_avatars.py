"""Add avatar_url and avatar_preset_id to users.

Revision ID: 20260519_avatars
Revises: 20260517_sla
Create Date: 2026-05-19
"""

import sqlalchemy as sa
from alembic import op

revision = "20260519_avatars"
down_revision = "20260517_sla"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("avatar_preset_id", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_preset_id")
    op.drop_column("users", "avatar_url")
