#!/usr/bin/env python3
"""One-off SLA reset against Neon/local Postgres. Prefer POST /api/v1/admin/reset-sla in prod."""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_SRC = ROOT / "apps" / "api" / "src"
if str(API_SRC) not in sys.path:
    sys.path.insert(0, str(API_SRC))


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


async def _run(*, anchor: str, dry_run: bool) -> None:
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from star_itsm_api.services.sla_reset import reset_all_ticket_sla

    url = _load_database_url()
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(url, pool_pre_ping=True)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as db:
        result = await reset_all_ticket_sla(db, anchor=anchor, dry_run=dry_run)  # type: ignore[arg-type]
    await engine.dispose()

    mode = "dry-run" if result.dry_run else "applied"
    print(
        f"SLA reset ({mode}, anchor={result.anchor}): "
        f"tickets={result.ticket_count}, updated={result.updated_count}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset SLA for all non-deleted tickets")
    parser.add_argument(
        "--anchor",
        choices=("created_at", "now"),
        default="created_at",
        help="created_at = from ticket creation (default); now = fresh clocks",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Count tickets only, do not write",
    )
    args = parser.parse_args()
    asyncio.run(_run(anchor=args.anchor, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
