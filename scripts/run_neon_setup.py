#!/usr/bin/env python3
"""Run Neon migrations and seeds in order. Reads DATABASE_URL from apps/api/.env."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]

MIGRATIONS = [
    "docs/auth-migration.sql",
    "docs/org-migration.sql",
    "docs/ticket-underaarsag-migration.sql",
    "docs/gdpr-attachments-migration.sql",
    "docs/ticket-activity-timestamps-migration.sql",
]

SEEDS = [
    "docs/seed-mvp.sql",
    "docs/seed-sub-causes.sql",
    "docs/seed-orgs-30.sql",
    "docs/seed-larrysanders.sql",
]


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
    raise SystemExit(
        "DATABASE_URL not found. Run from apps/api:\n"
        "  npx vercel env run -e production -- python ..\\..\\scripts\\run_neon_setup.py"
    )


def run_sql_file(conn: psycopg.Connection, path: Path) -> None:
    sql = path.read_text(encoding="utf-8")
    print(f"  -> {path.name} ...", end=" ", flush=True)
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()
    print("OK")


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
    print("Connecting to Neon...")
    with psycopg.connect(dsn, autocommit=False) as conn:
        if not table_exists(conn, "tickets"):
            init_path = ROOT / "init.sql"
            print(f"Schema missing — running {init_path.name}")
            run_sql_file(conn, init_path)
        else:
            print("Schema already present — skipping init.sql")

        print("\nMigrations:")
        for rel in MIGRATIONS:
            path = ROOT / rel
            if not path.exists():
                print(f"  SKIP missing {rel}")
                continue
            try:
                run_sql_file(conn, path)
            except psycopg.Error as exc:
                conn.rollback()
                print(f"FAILED\n     {exc}")
                return 1

        print("\nSeeds:")
        for rel in SEEDS:
            path = ROOT / rel
            if not path.exists():
                print(f"  SKIP missing {rel}")
                continue
            try:
                run_sql_file(conn, path)
            except psycopg.Error as exc:
                conn.rollback()
                print(f"FAILED\n     {exc}")
                return 1

        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM tickets WHERE deleted_at IS NULL")
            tickets = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL")
            users = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM organizations")
            orgs = cur.fetchone()[0]
        print(f"\nDone. tickets={tickets}, users={users}, organizations={orgs}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
