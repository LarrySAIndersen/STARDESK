#!/usr/bin/env python3
"""Return 0 if database looks bootstrapped (tickets + users), else 1."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]


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
