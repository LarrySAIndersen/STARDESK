"""Add password_policy_exempt flag on users.

Revision ID: 20260523_password_exempt
Revises: 20260523_kanban_v2
Create Date: 2026-05-23
"""

import sqlalchemy as sa
from alembic import op

revision = "20260523_password_exempt"
down_revision = "20260523_kanban_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "password_policy_exempt",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "password_policy_exempt")
