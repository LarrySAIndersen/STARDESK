"""Multi-role assignments per user (user_roles junction table).

Revision ID: 20260531_user_roles
Revises: 20260531_proto_passwords
Create Date: 2026-05-31
"""

from alembic import op

revision = "20260531_user_roles"
down_revision = "20260531_proto_passwords"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS user_roles (
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role VARCHAR(32) NOT NULL,
            PRIMARY KEY (user_id, role),
            CONSTRAINT user_roles_role_check CHECK (
                role IN (
                    'end_user',
                    'agent',
                    'admin',
                    'top_admin',
                    'supporter',
                    'stardesk_reviewer'
                )
            )
        )
        """
    )
    op.execute(
        """
        INSERT INTO user_roles (user_id, role)
        SELECT id, role FROM users WHERE deleted_at IS NULL
        ON CONFLICT DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS user_roles")
