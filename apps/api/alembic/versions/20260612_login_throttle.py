"""Add login_throttle table for auth rate limiting.

Revision ID: 20260612_login_throttle
Revises: 20260611_kundeportal_2_role
Create Date: 2026-06-12
"""

from alembic import op

revision = "20260612_login_throttle"
down_revision = "20260611_kundeportal_2_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS login_throttle (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            scope VARCHAR(16) NOT NULL,
            throttle_key VARCHAR(255) NOT NULL,
            failed_attempts INTEGER NOT NULL DEFAULT 0,
            window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            locked_until TIMESTAMPTZ NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_login_throttle_scope_key UNIQUE (scope, throttle_key)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_login_throttle_scope_key
            ON login_throttle (scope, throttle_key)
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS login_throttle")
