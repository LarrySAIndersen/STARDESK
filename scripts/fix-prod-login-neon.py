#!/usr/bin/env python3
"""Apply docs/fix-prototype-login-neon.sql on Neon (production main branch).

Usage (from repo root, with production DATABASE_URL):
  cd apps/api && uv run python ../../scripts/fix-prod-login-neon.py

Or via Vercel:
  cd apps/api && vercel env pull .env.production.local --environment=production
  set -a && source .env.production.local && set +a
  uv run python ../../scripts/fix-prod-login-neon.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

from star_itsm_api.core.prototype_credentials import prototype_bootstrap_password_hash
from star_itsm_api.db import async_session_factory, engine

ROOT = Path(__file__).resolve().parents[1]
SQL_FILE = ROOT / "docs" / "fix-prototype-login-neon.sql"


async def main() -> int:
    if engine is None or async_session_factory is None:
        print("ERROR: DATABASE_URL is not configured", file=sys.stderr)
        return 1
    if not SQL_FILE.is_file():
        print(f"ERROR: missing {SQL_FILE}", file=sys.stderr)
        return 1

    sql = SQL_FILE.read_text(encoding="utf-8")
    demo_hash = prototype_bootstrap_password_hash()
    print(f"Applying {SQL_FILE.name} …")
    print(f"Bootstrap hash prefix: {demo_hash[:29]}…")

    async with async_session_factory() as db:
        for statement in _split_sql(sql):
            await db.execute(text(statement))
        await db.commit()

        count = (
            await db.execute(
                text(
                    """
                    SELECT COUNT(*) FROM users
                    WHERE email LIKE '%@example.dk' AND deleted_at IS NULL
                    """
                )
            )
        ).scalar_one()
        locks = (
            await db.execute(
                text("SELECT COUNT(*) FROM login_throttle WHERE throttle_key LIKE '%@example.dk'")
            )
        ).scalar_one()
        print(f"Active @example.dk users: {count}")
        print(f"Remaining demo login_throttle rows: {locks}")

    print("Done. Test: python3 scripts/test-remote-login.py")
    return 0


def _split_sql(sql: str) -> list[str]:
    statements: list[str] = []
    buf: list[str] = []
    for line in sql.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        buf.append(line)
        if stripped.endswith(";"):
            chunk = "\n".join(buf).strip()
            if chunk:
                statements.append(chunk)
            buf = []
    tail = "\n".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
