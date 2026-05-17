"""Add ticket list performance indexes.

Revision ID: 20260517_perf
Revises:
Create Date: 2026-05-17
"""

from alembic import op

revision = "20260517_perf"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_tickets_created_at
        ON tickets (created_at DESC)
        WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_tickets_org_created
        ON tickets (organization_id, created_at DESC)
        WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_tickets_major_open
        ON tickets (is_major, status)
        WHERE deleted_at IS NULL AND is_major IS TRUE
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_tickets_major_open")
    op.execute("DROP INDEX IF EXISTS idx_tickets_org_created")
    op.execute("DROP INDEX IF EXISTS idx_tickets_created_at")
