"""Add ticket_type to sla_assignments for type-specific SLA matching.

Revision ID: 20260606_sla_ticket_type
Revises: 20260605_chatbot_messages
Create Date: 2026-06-06
"""

import sqlalchemy as sa

from alembic import op

revision = "20260606_sla_ticket_type"
down_revision = "20260605_chatbot_messages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sla_assignments",
        sa.Column("ticket_type", sa.String(length=32), nullable=True),
    )
    op.execute(
        """
        ALTER TABLE sla_assignments
        ADD CONSTRAINT sla_assignments_ticket_type_check
        CHECK (
            ticket_type IS NULL
            OR ticket_type IN ('service_request', 'incident', 'problem')
        )
        """
    )
    op.drop_index("idx_sla_assignments_lookup", table_name="sla_assignments")
    op.create_index(
        "idx_sla_assignments_lookup",
        "sla_assignments",
        ["priority", "ticket_type", "category_id", "subcategory_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_sla_assignments_lookup", table_name="sla_assignments")
    op.create_index(
        "idx_sla_assignments_lookup",
        "sla_assignments",
        ["priority", "category_id", "subcategory_id"],
    )
    op.drop_constraint("sla_assignments_ticket_type_check", "sla_assignments", type_="check")
    op.drop_column("sla_assignments", "ticket_type")
