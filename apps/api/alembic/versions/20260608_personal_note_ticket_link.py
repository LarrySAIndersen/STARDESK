"""Link personal notes to tickets with visibility.

Revision ID: 20260608_personal_note_ticket_link
Revises: 20260607_personal_note_category
Create Date: 2026-06-08
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260608_personal_note_ticket_link"
down_revision = "20260607_personal_note_category"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "personal_notes",
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "personal_notes",
        sa.Column("visibility", sa.String(length=16), nullable=False, server_default="private"),
    )
    op.create_foreign_key(
        "fk_personal_notes_ticket_id",
        "personal_notes",
        "tickets",
        ["ticket_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "idx_personal_notes_ticket_id",
        "personal_notes",
        ["ticket_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_personal_notes_ticket_id", table_name="personal_notes")
    op.drop_constraint("fk_personal_notes_ticket_id", "personal_notes", type_="foreignkey")
    op.drop_column("personal_notes", "visibility")
    op.drop_column("personal_notes", "ticket_id")
