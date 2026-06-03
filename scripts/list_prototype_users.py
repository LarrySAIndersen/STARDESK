#!/usr/bin/env python3
"""List active prototype users from the database (emails only — no passwords)."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]

ROLE_ORDER = ("top_admin", "admin", "supporter", "agent", "end_user")


def _normalize_url(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql://")


def load_database_url() -> str:
    from_env = os.environ.get("DATABASE_URL", "").strip()
    if from_env:
        return _normalize_url(from_env)

    for name in (".env.local", ".env"):
        env_path = ROOT / "apps" / "api" / name
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("DATABASE_URL="):
                url = line.split("=", 1)[1].strip().strip('"').strip("'")
                if url:
                    return _normalize_url(url)
    raise SystemExit("DATABASE_URL not found")


def fetch_prototype_users(
    conn: psycopg.Connection, *, limit: int | None
) -> tuple[list[tuple[str, str, str]], int]:
    role_case = " ".join(
        f"WHEN '{role}' THEN {index}" for index, role in enumerate(ROLE_ORDER)
    )
    base_where = """
        FROM users
        WHERE deleted_at IS NULL
          AND is_active = TRUE
          AND email LIKE '%@example.dk'
    """
    count_sql = f"SELECT COUNT(*) {base_where}"
    list_sql = f"""
        SELECT email, display_name, role
        {base_where}
        ORDER BY
          CASE role
            {role_case}
            ELSE 99
          END,
          email
    """
    with conn.cursor() as cur:
        cur.execute(count_sql)
        total = int(cur.fetchone()[0])
        if limit is not None:
            list_sql += " LIMIT %s"
            cur.execute(list_sql, (limit,))
        else:
            cur.execute(list_sql)
        rows = cur.fetchall()
    users = [(str(email), str(display_name), str(role)) for email, display_name, role in rows]
    return users, total


def format_user_line(email: str, display_name: str, role: str) -> str:
    return f"  {email}  {display_name}  ({role})"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="List prototype users seeded in the database (@example.dk)."
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=8,
        help="Max rows to print (default: 8; use 0 for all)",
    )
    args = parser.parse_args()
    limit = None if args.limit == 0 else args.limit

    try:
        dsn = load_database_url()
    except SystemExit as exc:
        print(f"(skip: {exc})", file=sys.stderr)
        return 0

    try:
        with psycopg.connect(dsn) as conn:
            users, total = fetch_prototype_users(conn, limit=limit)
    except Exception as exc:  # noqa: BLE001 — dev helper; show connection errors clearly
        print(f"(skip: could not query users: {exc})", file=sys.stderr)
        return 0

    if not users:
        print("(no active @example.dk users in database yet)", file=sys.stderr)
        return 0

    for email, display_name, role in users:
        print(format_user_line(email, display_name, role))

    if limit is not None and total > len(users):
        print(f"  … and {total - len(users)} more (scripts/list_prototype_users.py --limit 0)")

    print("  Password: PROTOTYPE_BOOTSTRAP_PASSWORD in apps/api/.env")
    return 0


if __name__ == "__main__":
    sys.exit(main())
