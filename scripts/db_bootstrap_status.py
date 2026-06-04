#!/usr/bin/env python3
"""Return 0 if database looks bootstrapped (tickets + users), else 1."""

from __future__ import annotations

import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "lib"))
from dev_database_url import load_database_url  # noqa: E402


def table_exists(conn: psycopg.Connection, table: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = %s
            )
            """,
            (table,),
        )
        row = cur.fetchone()
        return bool(row and row[0])


def main() -> int:
    dsn = load_database_url()
    with psycopg.connect(dsn) as conn:
        if not table_exists(conn, "tickets"):
            return 1
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL")
            users = int(cur.fetchone()[0])
        if users < 1:
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
