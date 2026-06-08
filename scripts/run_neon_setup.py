#!/usr/bin/env python3
"""Run Neon migrations and seeds in order. Reads DATABASE_URL from apps/api/.env.

See docs/DOCUMENTATION.md and docs/database-rebuild.md for structure and troubleshooting.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]

# Single source of truth — same folder as db_schema_sync.py at API startup.
MIGRATIONS_DIR = ROOT / "apps" / "api" / "src" / "star_itsm_api" / "sql" / "migrations"


def migration_paths() -> list[Path]:
    return sorted(MIGRATIONS_DIR.glob("*.sql"))

SEEDS = [
    "docs/seed-mvp.sql",
    "docs/seed-sub-causes.sql",
    "docs/seed-sf-ecosystem-reset.sql",
    "docs/seed-group-sample-tickets.sql",
    "docs/seed-ticket-intelligence.sql",
    "docs/seed-larrysanders.sql",
    "docs/seed-larrysanders2.sql",
    "docs/seed-landssupport-spoc.sql",
]


def _normalize_url(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql://")


def load_database_url() -> str:
    sys.path.insert(0, str(ROOT / "scripts"))
    from lib.dev_database_url import load_database_url as _load

    try:
        return _load()
    except SystemExit:
        raise SystemExit(
            "DATABASE_URL not found. Run from apps/api:\n"
            "  npx vercel env run -e production -- python ..\\..\\scripts\\run_neon_setup.py"
        ) from None


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


def _maybe_run_alembic() -> int:
    if "--with-alembic" not in sys.argv:
        return 0
    script = ROOT / "scripts" / "alembic_after_sql_setup.py"
    import subprocess

    print("\nAlembic (post-SQL):")
    result = subprocess.run(
        ["uv", "run", "python", str(script)],
        cwd=ROOT / "apps" / "api",
        env=os.environ.copy(),
        check=False,
    )
    return result.returncode


def _run_sql_paths(conn: psycopg.Connection, paths: list[Path], *, label: str) -> int:
    print(f"\n{label}:")
    for path in paths:
        try:
            run_sql_file(conn, path)
        except psycopg.Error as exc:
            conn.rollback()
            print(f"FAILED\n     {exc}")
            return 1
    return 0


def _run_seed_files(conn: psycopg.Connection) -> int:
    paths: list[Path] = []
    for rel in SEEDS:
        path = ROOT / rel
        if not path.exists():
            print(f"  SKIP missing {rel}")
            continue
        paths.append(path)
    return _run_sql_paths(conn, paths, label="Seeds")


def _print_counts(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM tickets WHERE deleted_at IS NULL")
        tickets = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL")
        users = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM organizations")
        orgs = cur.fetchone()[0]
    print(f"\nDone. tickets={tickets}, users={users}, organizations={orgs}")


def main() -> int:
    migrations_only = "--migrations-only" in sys.argv
    dsn = load_database_url()
    print("Connecting to database...")
    with psycopg.connect(dsn, autocommit=False) as conn:
        if not table_exists(conn, "tickets"):
            init_path = ROOT / "init.sql"
            print(f"Schema missing — running {init_path.name}")
            run_sql_file(conn, init_path)
        else:
            print("Schema already present — skipping init.sql")

        if _run_sql_paths(conn, migration_paths(), label="Migrations") != 0:
            return 1

        if migrations_only:
            print("\nSeeds: skipped (--migrations-only)")
        elif _run_seed_files(conn) != 0:
            return 1

        _print_counts(conn)

    alembic_rc = _maybe_run_alembic()
    return alembic_rc if alembic_rc != 0 else 0


if __name__ == "__main__":
    sys.exit(main())
