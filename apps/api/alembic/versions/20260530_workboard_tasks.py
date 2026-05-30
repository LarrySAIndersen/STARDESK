"""Work Board tasks persisted in Neon (canvas JSON is cache only).

Revision ID: 20260530_workboard_tasks
Revises: 20260530_ticket_stakeholders
Create Date: 2026-05-30
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260530_workboard_tasks"
down_revision = "20260530_ticket_stakeholders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workboard_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("canvas_id", sa.String(length=32), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("priority", sa.String(length=8), nullable=False, server_default="P2"),
        sa.Column("owner", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("tags", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("source", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("parent_canvas_id", sa.String(length=32), nullable=True),
        sa.Column(
            "extra",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "field_history",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "activity_log",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["workboard_tasks.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("canvas_id"),
        sa.UniqueConstraint("number"),
    )
    op.create_index("idx_workboard_tasks_status", "workboard_tasks", ["status"])
    op.create_index("idx_workboard_tasks_number", "workboard_tasks", ["number"])
    op.create_index("idx_workboard_tasks_parent_id", "workboard_tasks", ["parent_id"])
    op.create_index(
        "idx_workboard_tasks_parent_canvas_id",
        "workboard_tasks",
        ["parent_canvas_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_workboard_tasks_parent_canvas_id", table_name="workboard_tasks")
    op.drop_index("idx_workboard_tasks_parent_id", table_name="workboard_tasks")
    op.drop_index("idx_workboard_tasks_number", table_name="workboard_tasks")
    op.drop_index("idx_workboard_tasks_status", table_name="workboard_tasks")
    op.drop_table("workboard_tasks")
