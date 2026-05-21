"""Allow supporter rettighedsgruppe on users.

Revision ID: 20260520_supporter
Revises: 20260519_avatars
Create Date: 2026-05-20
"""

from alembic import op

revision = "20260520_supporter"
down_revision = "20260519_avatars"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check")
    op.execute(
        """
        ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('end_user', 'agent', 'admin', 'top_admin', 'supporter'))
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check")
    op.execute(
        """
        ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('end_user', 'agent', 'admin', 'top_admin'))
        """
    )
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'supporter'")
