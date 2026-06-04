import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from star_itsm_api.models.base import Base


class PerformanceBenchmarkRun(Base):
    """One performance measurement run (load-test, playwright, or jmeter)."""

    __tablename__ = "performance_benchmark_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scenario: Mapped[str] = mapped_column(String(32), nullable=False)
    agent: Mapped[str] = mapped_column(String(32), nullable=False)
    environment: Mapped[str] = mapped_column(String(32), nullable=False)
    git_branch: Mapped[str | None] = mapped_column(String(256), nullable=True)
    overall_pass: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    metrics: Mapped[list["PerformanceBenchmarkMetric"]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
    )


class PerformanceBenchmarkMetric(Base):
    """Expected vs actual metric for a single endpoint or UI scenario."""

    __tablename__ = "performance_benchmark_metrics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("performance_benchmark_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    metric_key: Mapped[str] = mapped_column(String(64), nullable=False)
    endpoint_or_scenario: Mapped[str] = mapped_column(Text, nullable=False)
    plan_items: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    expected_p95_ms: Mapped[float] = mapped_column(Float, nullable=False)
    actual_p95_ms: Mapped[float] = mapped_column(Float, nullable=False)
    expected_error_rate_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_error_rate_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    pass_: Mapped[bool] = mapped_column("pass", Boolean, nullable=False)
    raw_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    run: Mapped[PerformanceBenchmarkRun] = relationship(back_populates="metrics")
