"""Per-user UI layout lock (classic vs modern).

Revision ID: 20260521_ui_mode
Revises: 20260520_supporter
Create Date: 2026-05-21
"""

import sqlalchemy as sa

from alembic import op

revision = "20260521_ui_mode"
down_revision = "20260520_supporter"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("ui_mode", sa.String(length=16), nullable=True),
    )
    op.execute(
        """
        ALTER TABLE users ADD CONSTRAINT users_ui_mode_check
        CHECK (ui_mode IS NULL OR ui_mode IN ('modern', 'classic'))
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_ui_mode_check")
    op.drop_column("users", "ui_mode")
