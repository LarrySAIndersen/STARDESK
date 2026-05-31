"""SLA operational settings and ticket pause columns.

Revision ID: 20260524_sla_settings
Revises: 20260523_clear_must_change
Create Date: 2026-05-24
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260524_sla_settings"
down_revision = "20260523_clear_must_change"
branch_labels = None
depends_on = None

DEFAULT_SETTINGS_ID = "00000000-0000-4000-8000-000000000001"


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE tickets
            ADD COLUMN IF NOT EXISTS sla_paused_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS sla_pause_total_seconds INTEGER NOT NULL DEFAULT 0
        """
    )

    op.create_table(
        "sla_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("pause_on_hold", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column(
            "pause_statuses",
            postgresql.ARRAY(sa.String(32)),
            nullable=False,
            server_default=sa.text("ARRAY['on_hold']::varchar[]"),
        ),
        sa.Column(
            "trigger_team_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
            server_default=sa.text("'{}'::uuid[]"),
        ),
        sa.Column(
            "sla_starts_on_team_assignment",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("FALSE"),
        ),
        sa.Column("due_soon_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )

    op.execute(
        f"""
        INSERT INTO sla_settings (id)
        VALUES ('{DEFAULT_SETTINGS_ID}'::uuid)
        ON CONFLICT (id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_table("sla_settings")
    op.drop_column("tickets", "sla_pause_total_seconds")
    op.drop_column("tickets", "sla_paused_at")
