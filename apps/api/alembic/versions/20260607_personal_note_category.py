"""Add category to personal_notes.

Revision ID: 20260607_personal_note_category
Revises: 20260606_sla_ticket_type
Create Date: 2026-06-07
"""

import sqlalchemy as sa

from alembic import op

revision = "20260607_personal_note_category"
down_revision = "20260606_sla_ticket_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "personal_notes",
        sa.Column("category", sa.String(length=32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("personal_notes", "category")
