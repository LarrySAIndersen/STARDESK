"""Clear must_change_password for prototype demo users.

Revision ID: 20260523_clear_must_change
Revises: 20260523_password_exempt
Create Date: 2026-05-23
"""

from alembic import op

revision = "20260523_clear_must_change"
down_revision = "20260523_password_exempt"
branch_labels = None
depends_on = None

PROTOTYPE_EMAILS = (
    "submitter@example.dk",
    "agent@example.dk",
    "admin@example.dk",
    "larrysanders@example.dk",
    "larrysanders2@example.dk",
)


def upgrade() -> None:
    emails = ", ".join(f"'{email}'" for email in PROTOTYPE_EMAILS)
    op.execute(
        f"""
        UPDATE users
        SET must_change_password = FALSE,
            password_policy_exempt = TRUE,
            updated_at = NOW()
        WHERE deleted_at IS NULL
          AND email IN ({emails})
        """
    )


def downgrade() -> None:
    pass
