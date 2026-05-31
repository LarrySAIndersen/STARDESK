"""Reset documented prototype demo password hashes in production DB.

Revision ID: 20260531_proto_passwords
Revises: 20260530_page_review_notes
Create Date: 2026-05-31
"""

from alembic import op
from star_itsm_api.core.prototype_credentials import (
    larry_prototype_password_hash,
    prototype_bootstrap_password_hash,
)

revision = "20260531_proto_passwords"
down_revision = "20260530_page_review_notes"
branch_labels = None
depends_on = None

LARRY_EMAILS = (
    "larrysanders@example.dk",
    "larrysanders2@example.dk",
)


def upgrade() -> None:
    larry_hash = larry_prototype_password_hash().replace("'", "''")
    stardesk_hash = prototype_bootstrap_password_hash().replace("'", "''")
    larry = ", ".join(f"'{email}'" for email in LARRY_EMAILS)
    op.execute(
        f"""
        UPDATE users
        SET password_hash = '{larry_hash}',
            is_active = TRUE,
            deleted_at = NULL,
            must_change_password = FALSE,
            password_policy_exempt = TRUE,
            updated_at = NOW()
        WHERE deleted_at IS NULL
          AND email IN ({larry})
        """
    )
    op.execute(
        f"""
        UPDATE users
        SET password_hash = '{stardesk_hash}',
            is_active = TRUE,
            deleted_at = NULL,
            must_change_password = FALSE,
            password_policy_exempt = TRUE,
            updated_at = NOW()
        WHERE deleted_at IS NULL
          AND email LIKE '%@example.dk'
          AND email NOT IN ({larry})
        """
    )


def downgrade() -> None:
    pass
