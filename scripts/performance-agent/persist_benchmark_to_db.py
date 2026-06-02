#!/usr/bin/env python3
"""Persist performance benchmark reports (expected vs actual) to Neon."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
REPORTS = ROOT / "reports"
API_SRC = ROOT / "apps" / "api" / "src"
LATEST_DB_JSON = REPORTS / "performance-benchmark-db-latest.json"

if str(API_SRC) not in sys.path:
    sys.path.insert(0, str(API_SRC))

# Mirrors scripts/performance-agent/performance-plan.mjs DEFAULT_THRESHOLDS
API_THRESHOLDS: dict[str, float] = {
    "health": 500,
    "login": 1500,
    "tickets-list": 2000,
    "ticket-detail": 2000,
    "dashboard": 2500,
    "categories": 800,
    "kanban-boards": 1500,
    "kanban-board-detail": 2500,
    "default": 2000,
}

UI_THRESHOLDS: dict[str, float] = {
    "tickets-list": 4000,
    "ticket-detail": 4500,
    "kanban": 5000,
    "dashboard": 4500,
    "admin-categories": 5000,
    "default": 5000,
}

GLOBAL_THRESHOLDS = {"p95Ms": 2000, "errorRatePct": 1.0}

API_ENDPOINT_LABELS: dict[str, str] = {
    "health": "GET /health",
    "login": "POST /api/v1/auth/login",
    "tickets-list": "GET /api/v1/tickets",
    "ticket-detail": "GET /api/v1/tickets/{id}",
    "dashboard": "GET /api/v1/reports/dashboard",
    "categories": "GET /api/v1/categories",
    "kanban-boards": "GET /api/v1/kanban/boards",
    "kanban-board-detail": "GET /api/v1/kanban/boards/{id}",
}

API_PLAN_ITEMS: dict[str, list[int]] = {
    "health": [50],
    "login": [9],
    "tickets-list": [1, 5, 13, 14],
    "ticket-detail": [1, 5],
    "dashboard": [31],
    "categories": [6],
    "kanban-boards": [25],
    "kanban-board-detail": [1, 25],
}


def _load_database_url() -> str:
    from_env = os.environ.get("DATABASE_URL", "").strip()
    if from_env:
        return from_env
    for name in (".env.local", ".env"):
        env_path = ROOT / "apps" / "api" / name
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DATABASE_URL not set and not found in apps/api/.env")


def _read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _parse_iso(value: str | None) -> datetime:
    if not value:
        return datetime.now(UTC)
    normalized = value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


async def _fetch_environment() -> str:
    import httpx

    base = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{base}/health")
            if resp.status_code == 200:
                data = resp.json()
                return str(data.get("stardesk_env") or data.get("environment") or "test")
    except Exception:
        pass
    return os.environ.get("STARDESK_ENV", "test")


def _git_branch() -> str | None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        branch = (result.stdout or "").strip()
        return branch or None
    except OSError:
        return None


def _threshold_api(endpoint_id: str, report_thresholds: dict[str, Any] | None) -> float:
    if report_thresholds and endpoint_id in report_thresholds:
        return float(report_thresholds[endpoint_id])
    return float(API_THRESHOLDS.get(endpoint_id, API_THRESHOLDS["default"]))


def _threshold_ui(scenario_id: str, report_thresholds: dict[str, Any] | None) -> float:
    if report_thresholds and scenario_id in report_thresholds:
        return float(report_thresholds[scenario_id])
    return float(UI_THRESHOLDS.get(scenario_id, UI_THRESHOLDS["default"]))


def _build_load_test_metrics(report: dict[str, Any]) -> tuple[list[dict[str, Any]], bool]:
    rows: list[dict[str, Any]] = []
    all_pass = True
    endpoint_stats = report.get("endpointStats") or {}
    global_thresholds = report.get("thresholds") or GLOBAL_THRESHOLDS

    for endpoint_id, stats in endpoint_stats.items():
        expected = _threshold_api(endpoint_id, None)
        actual = float(stats.get("p95") or 0)
        passed = actual <= expected and (stats.get("errors") or 0) == 0
        all_pass = all_pass and passed
        rows.append(
            {
                "metric_key": endpoint_id,
                "endpoint_or_scenario": API_ENDPOINT_LABELS.get(endpoint_id, endpoint_id),
                "plan_items": API_PLAN_ITEMS.get(endpoint_id),
                "expected_p95_ms": expected,
                "actual_p95_ms": actual,
                "expected_error_rate_pct": None,
                "actual_error_rate_pct": None,
                "pass": passed,
                "raw_json": stats,
            }
        )

    global_p95 = float((report.get("latencyMs") or {}).get("p95") or 0)
    global_err = float(report.get("errorRatePct") or 0)
    exp_p95 = float(global_thresholds.get("p95Ms", GLOBAL_THRESHOLDS["p95Ms"]))
    exp_err = float(global_thresholds.get("errorRatePct", GLOBAL_THRESHOLDS["errorRatePct"]))
    global_pass = global_p95 <= exp_p95 and global_err <= exp_err
    all_pass = all_pass and global_pass
    rows.append(
        {
            "metric_key": "__global__",
            "endpoint_or_scenario": "Overall load-test",
            "plan_items": [50],
            "expected_p95_ms": exp_p95,
            "actual_p95_ms": global_p95,
            "expected_error_rate_pct": exp_err,
            "actual_error_rate_pct": global_err,
            "pass": global_pass,
            "raw_json": {
                "totalRequests": report.get("totalRequests"),
                "totalErrors": report.get("totalErrors"),
                "thresholdBreaches": report.get("thresholdBreaches"),
            },
        }
    )
    return rows, all_pass


def _build_playwright_metrics(report: dict[str, Any]) -> tuple[list[dict[str, Any]], bool]:
    rows: list[dict[str, Any]] = []
    all_pass = True
    thresholds = report.get("thresholds") or {}
    scenario_stats = report.get("scenarioStats") or {}

    for scenario_id, stats in scenario_stats.items():
        expected = float(stats.get("thresholdMs") or _threshold_ui(scenario_id, thresholds))
        actual = float((stats.get("wallClockMs") or {}).get("p95") or 0)
        errors = int(stats.get("errors") or 0)
        passed = actual <= expected and errors == 0
        all_pass = all_pass and passed
        web_path = next(
            (s.get("webPath") for s in report.get("scenarios") or [] if s.get("id") == scenario_id),
            scenario_id,
        )
        rows.append(
            {
                "metric_key": scenario_id,
                "endpoint_or_scenario": f"{web_path} ({stats.get('label') or scenario_id})",
                "plan_items": stats.get("planItems"),
                "expected_p95_ms": expected,
                "actual_p95_ms": actual,
                "expected_error_rate_pct": 0.0,
                "actual_error_rate_pct": 100.0 if errors else 0.0,
                "pass": passed,
                "raw_json": stats,
            }
        )
    return rows, all_pass


async def persist_reports(*, dry_run: bool = False) -> dict[str, Any]:
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from star_itsm_api.db import normalize_database_url
    from star_itsm_api.models.performance_benchmark import (
        PerformanceBenchmarkMetric,
        PerformanceBenchmarkRun,
    )

    load_report = _read_json(REPORTS / "performance-load-test-latest.json")
    pw_report = _read_json(REPORTS / "performance-playwright-latest.json")
    if not load_report and not pw_report:
        raise SystemExit("No performance reports found in reports/")

    environment = await _fetch_environment()
    git_branch = _git_branch()
    inserted_runs: list[dict[str, Any]] = []
    summary_rows: list[dict[str, Any]] = []

    run_specs: list[tuple[str, dict[str, Any], str]] = []
    if load_report:
        run_specs.append(("load-test", load_report, load_report.get("scenario") or "baseline"))
    if pw_report:
        run_specs.append(("playwright", pw_report, "baseline"))

    if dry_run:
        for agent, report, scenario in run_specs:
            if agent == "load-test":
                metrics, overall_pass = _build_load_test_metrics(report)
            else:
                metrics, overall_pass = _build_playwright_metrics(report)
            run_id = str(uuid.uuid4())
            inserted_runs.append({"id": run_id, "agent": agent, "scenario": scenario, "overall_pass": overall_pass})
            for m in metrics:
                summary_rows.append({"agent": agent, "run_id": run_id, **m})
        return {"runs": inserted_runs, "metrics": summary_rows, "dry_run": True}

    url = normalize_database_url(_load_database_url())
    engine = create_async_engine(url, pool_pre_ping=True)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        for agent, report, scenario in run_specs:
            if agent == "load-test":
                metrics, overall_pass = _build_load_test_metrics(report)
                run_at = _parse_iso(report.get("finishedAt") or report.get("startedAt"))
            else:
                metrics, overall_pass = _build_playwright_metrics(report)
                run_at = _parse_iso(report.get("generatedAt"))

            run = PerformanceBenchmarkRun(
                id=uuid.uuid4(),
                run_at=run_at,
                scenario=scenario,
                agent=agent,
                environment=environment,
                git_branch=git_branch,
                overall_pass=overall_pass,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            session.add(run)

            for m in metrics:
                metric = PerformanceBenchmarkMetric(
                    id=uuid.uuid4(),
                    run_id=run.id,
                    metric_key=m["metric_key"],
                    endpoint_or_scenario=m["endpoint_or_scenario"],
                    plan_items=m.get("plan_items"),
                    expected_p95_ms=m["expected_p95_ms"],
                    actual_p95_ms=m["actual_p95_ms"],
                    expected_error_rate_pct=m.get("expected_error_rate_pct"),
                    actual_error_rate_pct=m.get("actual_error_rate_pct"),
                    pass_=m["pass"],
                    raw_json=m.get("raw_json"),
                    created_at=datetime.now(UTC),
                )
                session.add(metric)
                summary_rows.append({"agent": agent, "run_id": str(run.id), **m})

            inserted_runs.append(
                {
                    "id": str(run.id),
                    "agent": agent,
                    "scenario": scenario,
                    "environment": environment,
                    "overall_pass": overall_pass,
                    "run_at": run_at.isoformat(),
                }
            )

        await session.commit()

    await engine.dispose()

    out = {
        "persistedAt": datetime.now(UTC).isoformat(),
        "environment": environment,
        "gitBranch": git_branch,
        "runs": inserted_runs,
        "metricCount": len(summary_rows),
    }
    REPORTS.mkdir(parents=True, exist_ok=True)
    LATEST_DB_JSON.write_text(f"{json.dumps(out, indent=2)}\n", encoding="utf-8")
    return {"runs": inserted_runs, "metrics": summary_rows, "manifest": out}


async def query_latest(limit: int = 20) -> None:
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    from sqlalchemy.orm import selectinload

    from star_itsm_api.db import normalize_database_url
    from star_itsm_api.models.performance_benchmark import (
        PerformanceBenchmarkMetric,
        PerformanceBenchmarkRun,
    )

    url = normalize_database_url(_load_database_url())
    engine = create_async_engine(url, pool_pre_ping=True)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        result = await session.execute(
            select(PerformanceBenchmarkRun)
            .options(selectinload(PerformanceBenchmarkRun.metrics))
            .order_by(PerformanceBenchmarkRun.run_at.desc())
            .limit(3)
        )
        runs = result.scalars().all()

    await engine.dispose()

    if not runs:
        print("No benchmark runs in database.")
        return

    for run in runs:
        print(f"\nRun {run.id} | {run.agent} | {run.scenario} | env={run.environment} | pass={run.overall_pass}")
        print(f"  run_at={run.run_at.isoformat()} branch={run.git_branch or '—'}")
        print("| metric | expected p95 | actual p95 | pass |")
        print("|--------|-------------:|-----------:|:----:|")
        for m in sorted(run.metrics, key=lambda x: x.metric_key)[:limit]:
            err = ""
            if m.expected_error_rate_pct is not None:
                err = f" err {m.actual_error_rate_pct}%<={m.expected_error_rate_pct}%"
            print(
                f"| {m.metric_key} | {m.expected_p95_ms:.0f} | {m.actual_p95_ms:.0f} | "
                f"{'OK' if m.pass_ else 'FAIL'}{err} |"
            )


def _print_summary(result: dict[str, Any]) -> None:
    print("\n=== Benchmark persist summary ===")
    if result.get("dry_run"):
        print("(dry-run — nothing written)")
    for run in result["runs"]:
        status = "PASS" if run["overall_pass"] else "FAIL"
        print(f"  {run['agent']} ({run['scenario']}): {status} run_id={run['id']}")
    print(f"\nMetric rows: {len(result['metrics'])}")
    print("\n| agent | metric | expected p95 | actual p95 | pass |")
    print("|-------|--------|-------------:|-----------:|:----:|")
    for row in result["metrics"]:
        print(
            f"| {row['agent']} | {row['metric_key']} | {row['expected_p95_ms']:.0f} | "
            f"{row['actual_p95_ms']:.0f} | {'OK' if row['pass'] else 'FAIL'} |"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Persist performance benchmarks to Neon")
    parser.add_argument("--dry-run", action="store_true", help="Parse reports without DB write")
    parser.add_argument("--query", action="store_true", help="Show latest runs from DB")
    args = parser.parse_args()

    if args.query:
        asyncio.run(query_latest())
        return

    result = asyncio.run(persist_reports(dry_run=args.dry_run))
    _print_summary(result)
    if not args.dry_run and result.get("manifest"):
        print(f"\nManifest: {LATEST_DB_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
