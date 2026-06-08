"""Add IDE note_number to personal notes (Idé-sagstype).

Revision ID: 20260609_personal_note_number
Revises: 20260608_personal_note_ticket_link
Create Date: 2026-06-09
"""

import sqlalchemy as sa
from alembic import op

revision = "20260609_personal_note_number"
down_revision = "20260608_personal_note_ticket_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "personal_notes",
        sa.Column("note_number", sa.String(length=32), nullable=True),
    )
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            """
            SELECT id, created_at
            FROM personal_notes
            WHERE note_number IS NULL AND deleted_at IS NULL
            ORDER BY created_at ASC
            """
        )
    ).fetchall()
    counters: dict[int, int] = {}
    for row in rows:
        created = row.created_at
        year = created.year if created is not None else 2026
        counters[year] = counters.get(year, 0) + 1
        note_number = f"IDE-{year}-{counters[year]:05d}"
        conn.execute(
            sa.text("UPDATE personal_notes SET note_number = :num WHERE id = :id"),
            {"num": note_number, "id": row.id},
        )
    op.alter_column("personal_notes", "note_number", nullable=False)
    op.create_index(
        "ix_personal_notes_note_number",
        "personal_notes",
        ["note_number"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_personal_notes_note_number", table_name="personal_notes")
    op.drop_column("personal_notes", "note_number")
