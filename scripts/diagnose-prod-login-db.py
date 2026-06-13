#!/usr/bin/env python3
"""Inspect Neon/prod DB for login blockers and optionally apply fix-prototype-login-neon.sql.

Usage:
  export DATABASE_URL='postgresql+asyncpg://…'   # Neon **main** for production
  cd apps/api && uv run python ../../scripts/diagnose-prod-login-db.py
  cd apps/api && uv run python ../../scripts/diagnose-prod-login-db.py --apply-fix
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

from star_itsm_api.core.prototype_credentials import prototype_bootstrap_password_hash
from star_itsm_api.core.security import verify_password
from star_itsm_api.db import async_session_factory, engine

ROOT = Path(__file__).resolve().parents[1]
FIX_SQL = ROOT / "docs" / "fix-prototype-login-neon.sql"

DEMO_EMAILS = (
    "sf01@example.dk",
    "sf02@example.dk",
    "sf03@example.dk",
    "submitter@example.dk",
    "larrysanders@example.dk",
    "benny.andersen@example.dk",
)

USER_COLUMNS = (
    "password_hash",
    "must_change_password",
    "password_policy_exempt",
    "organization_id",
    "avatar_url",
    "avatar_preset_id",
    "ui_mode",
)


async def _column_exists(db, table: str, column: str) -> bool:
    row = await db.execute(
        text(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = :table AND column_name = :column
            """
        ),
        {"table": table, "column": column},
    )
    return row.scalar() is not None


async def _table_exists(db, table: str) -> bool:
    row = await db.execute(
        text(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = :table
            """
        ),
        {"table": table},
    )
    return row.scalar() is not None


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


async def diagnose(*, apply_fix: bool) -> int:
    if engine is None or async_session_factory is None:
        print("ERROR: DATABASE_URL not configured", file=sys.stderr)
        return 1

    expected_hash = prototype_bootstrap_password_hash()
    problems: list[str] = []

    async with async_session_factory() as db:
        ping = (await db.execute(text("SELECT current_database(), current_user"))).one()
        print(f"DB: database={ping[0]!r} user={ping[1]!r}")

        if not await _table_exists(db, "users"):
            problems.append("MISSING TABLE: users")
        if not await _table_exists(db, "login_throttle"):
            problems.append("MISSING TABLE: login_throttle")

        for col in USER_COLUMNS:
            if not await _column_exists(db, "users", col):
                problems.append(f"MISSING COLUMN: users.{col}")

        print("\n--- Demo users ---")
        for email in DEMO_EMAILS:
            row = await db.execute(
                text(
                    """
                    SELECT email, is_active, deleted_at IS NOT NULL AS deleted, password_hash
                    FROM users WHERE lower(email) = lower(:email)
                    """
                ),
                {"email": email},
            )
            user = row.fetchone()
            if user is None:
                print(f"{email}: NOT FOUND")
                problems.append(f"MISSING USER: {email}")
                continue
            mapping = user._mapping
            ph = mapping["password_hash"]
            hash_ok = bool(ph) and verify_password("Stardesk2026!", ph)
            pepper_ok = ph == expected_hash
            print(
                f"{email}: active={mapping['is_active']} deleted={mapping['deleted']} "
                f"password_ok={hash_ok} pepper_hash={pepper_ok}"
            )
            if not mapping["is_active"] or mapping["deleted"]:
                problems.append(f"INACTIVE USER: {email}")
            if not hash_ok:
                problems.append(f"BAD PASSWORD HASH: {email}")

        locks = []
        if await _table_exists(db, "login_throttle"):
            lock_result = await db.execute(
                text(
                    """
                    SELECT throttle_key, scope, failed_attempts, locked_until
                    FROM login_throttle
                    WHERE throttle_key = ANY(:emails)
                    ORDER BY throttle_key, scope
                    """
                ),
                {"emails": list(DEMO_EMAILS)},
            )
            locks = lock_result.fetchall()
        else:
            problems.append("MISSING TABLE: login_throttle")
        print(f"\n--- login_throttle rows for demo emails: {len(locks)} ---")
        for lock in locks:
            print(dict(lock._mapping))

        if apply_fix:
            if not FIX_SQL.is_file():
                print(f"ERROR: {FIX_SQL} missing", file=sys.stderr)
                return 1
            print(f"\nApplying {FIX_SQL.name} …")
            for statement in _split_sql(FIX_SQL.read_text(encoding="utf-8")):
                await db.execute(text(statement))
            await db.commit()
            print("Fix SQL applied.")
            return await diagnose(apply_fix=False)

    print("\n--- Summary ---")
    if problems:
        print(f"FOUND {len(problems)} issue(s):")
        for item in problems:
            print(f"  - {item}")
        print("\nRun with --apply-fix after reviewing docs/fix-prototype-login-neon.sql")
        return 2

    print("OK — schema and demo users look ready for Stardesk2026!")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Diagnose prod login DB state on Neon")
    parser.add_argument(
        "--apply-fix",
        action="store_true",
        help="Run docs/fix-prototype-login-neon.sql then re-diagnose",
    )
    args = parser.parse_args()
    return asyncio.run(diagnose(apply_fix=args.apply_fix))


if __name__ == "__main__":
    raise SystemExit(main())
