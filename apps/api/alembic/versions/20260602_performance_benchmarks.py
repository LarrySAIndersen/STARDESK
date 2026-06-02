"""Performance benchmark runs and metrics (expected vs actual).

Revision ID: 20260602_perf_benchmarks
Revises: 20260531_user_roles
Create Date: 2026-06-02
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260602_perf_benchmarks"
down_revision = "20260531_user_roles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "performance_benchmark_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("run_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scenario", sa.String(length=32), nullable=False),
        sa.Column("agent", sa.String(length=32), nullable=False),
        sa.Column("environment", sa.String(length=32), nullable=False),
        sa.Column("git_branch", sa.String(length=256), nullable=True),
        sa.Column("overall_pass", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_performance_benchmark_runs_run_at",
        "performance_benchmark_runs",
        ["run_at"],
    )
    op.create_index(
        "idx_performance_benchmark_runs_agent",
        "performance_benchmark_runs",
        ["agent"],
    )

    op.create_table(
        "performance_benchmark_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("metric_key", sa.String(length=64), nullable=False),
        sa.Column("endpoint_or_scenario", sa.Text(), nullable=False),
        sa.Column("plan_items", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("expected_p95_ms", sa.Float(), nullable=False),
        sa.Column("actual_p95_ms", sa.Float(), nullable=False),
        sa.Column("expected_error_rate_pct", sa.Float(), nullable=True),
        sa.Column("actual_error_rate_pct", sa.Float(), nullable=True),
        sa.Column("pass", sa.Boolean(), nullable=False),
        sa.Column("raw_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["performance_benchmark_runs.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_performance_benchmark_metrics_run_id",
        "performance_benchmark_metrics",
        ["run_id"],
    )
    op.create_index(
        "idx_performance_benchmark_metrics_metric_key",
        "performance_benchmark_metrics",
        ["metric_key"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_performance_benchmark_metrics_metric_key",
        table_name="performance_benchmark_metrics",
    )
    op.drop_index(
        "idx_performance_benchmark_metrics_run_id",
        table_name="performance_benchmark_metrics",
    )
    op.drop_table("performance_benchmark_metrics")
    op.drop_index("idx_performance_benchmark_runs_agent", table_name="performance_benchmark_runs")
    op.drop_index("idx_performance_benchmark_runs_run_at", table_name="performance_benchmark_runs")
    op.drop_table("performance_benchmark_runs")
