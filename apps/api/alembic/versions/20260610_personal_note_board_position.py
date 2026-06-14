"""Add board position columns for pinned personal notes.

Revision ID: 20260610_personal_note_board_position
Revises: 20260609_personal_note_number
Create Date: 2026-06-10
"""

import sqlalchemy as sa

from alembic import op

revision = "20260610_personal_note_board_position"
down_revision = "20260609_personal_note_number"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("personal_notes", sa.Column("board_x", sa.Float(), nullable=True))
    op.add_column("personal_notes", sa.Column("board_y", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("personal_notes", "board_y")
    op.drop_column("personal_notes", "board_x")