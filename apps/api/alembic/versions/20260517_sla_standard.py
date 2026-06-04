"""Align SLA policies with standard P1–P4 targets.

Revision ID: 20260517_sla
Revises: 20260517_perf
Create Date: 2026-05-17
"""

from alembic import op

revision = "20260517_sla"
down_revision = "20260517_perf"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE sla_policies SET
            description = 'Kritisk P1 — respons 1 t, løsning 4 timer (24/7)',
            response_time_minutes = 60,
            resolution_time_minutes = 240,
            business_hours_only = FALSE
        WHERE name = 'Critical (24/7)'
        """
    )
    op.execute(
        """
        UPDATE sla_policies SET
            description = 'Høj P2 — respons 2 t, løsning 8 timer (24/7)',
            response_time_minutes = 120,
            resolution_time_minutes = 480,
            business_hours_only = FALSE
        WHERE name = 'High'
        """
    )
    op.execute(
        """
        UPDATE sla_policies SET
            description = 'Mellem P3 — respons 1 hverdag, løsning 3 hverdage',
            response_time_minutes = 480,
            resolution_time_minutes = 4320,
            business_hours_only = TRUE
        WHERE name = 'Medium'
        """
    )
    op.execute(
        """
        UPDATE sla_policies SET
            description = 'Lav P4 — respons 1 hverdag, løsning 5 hverdage',
            response_time_minutes = 480,
            resolution_time_minutes = 7200,
            business_hours_only = TRUE
        WHERE name = 'Low'
        """
    )


def downgrade() -> None:
    # SLA seed data migration — downgrade not supported.
    pass
