"""Reset documented prototype demo password hashes in production DB.

Revision ID: 20260531_proto_passwords
Revises: 20260530_page_review_notes
Create Date: 2026-05-31
"""

from alembic import op

revision = "20260531_proto_passwords"
down_revision = "20260530_page_review_notes"
branch_labels = None
depends_on = None

STARDESK_HASH = "$2b$12$Ss7R94HhRfq3Vq22M9ivS.1/OlQMmAdxdh9x9XaTwh9F0FmR1vlZC"
LARRY_HASH = "$2b$12$R4g4tKPsO73abz4FuHtEXuYIwua1Rr3zsfp/N4x3R5h07rV33EzXC"

LARRY_EMAILS = (
    "larrysanders@example.dk",
    "larrysanders2@example.dk",
)


def upgrade() -> None:
    larry = ", ".join(f"'{email}'" for email in LARRY_EMAILS)
    op.execute(
        f"""
        UPDATE users
        SET password_hash = '{LARRY_HASH}',
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
        SET password_hash = '{STARDESK_HASH}',
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
