#!/usr/bin/env python3
"""Local PostgreSQL bootstrap for dev VMs — credentials from env files only."""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from urllib.parse import quote_plus

import psycopg
from psycopg import sql

_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from lib.safe_repo_paths import resolve_repo_file, write_text_under_repo

_ENV_KEY_RE = re.compile(r"^[A-Z][A-Z0-9_]*$")

API_ENV = resolve_repo_file("apps", "api", ".env")
LOCAL_PG_ENV = resolve_repo_file("scripts", "local-postgres.env")


def _parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def _preserved_env_lines(raw: str) -> list[str]:
    """Keep comments and allowlisted keys; drop DATABASE_URL for replacement."""
    kept: list[str] = []
    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            kept.append(line)
            continue
        if stripped.startswith("DATABASE_URL="):
            continue
        key, _, _ = stripped.partition("=")
        if _ENV_KEY_RE.fullmatch(key.strip()):
            kept.append(line)
    return kept


def load_credentials() -> tuple[str, str]:
    user = os.environ.get("STARDESK_LOCAL_PG_USER", "").strip()
    password = os.environ.get("STARDESK_LOCAL_PG_PASSWORD", "").strip()

    if LOCAL_PG_ENV.exists():
        file_values = _parse_env_file(LOCAL_PG_ENV)
        user = user or file_values.get("STARDESK_LOCAL_PG_USER", "").strip()
        password = password or file_values.get("STARDESK_LOCAL_PG_PASSWORD", "").strip()

    user = user or "stardesk"
    if not password:
        raise SystemExit(
            "Set STARDESK_LOCAL_PG_PASSWORD in scripts/local-postgres.env "
            "(copy scripts/local-postgres.env.example)."
        )
    return user, password


def setup_local_postgres(user: str, password: str) -> None:
    with psycopg.connect("dbname=postgres") as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (user,))
            if not cur.fetchone():
                cur.execute(
                    sql.SQL("CREATE ROLE {} WITH LOGIN PASSWORD %s CREATEDB").format(
                        sql.Identifier(user)
                    ),
                    (password,),
                )
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", ("stardesk",))
            if not cur.fetchone():
                cur.execute(
                    sql.SQL("CREATE DATABASE {} OWNER {}").format(
                        sql.Identifier("stardesk"),
                        sql.Identifier(user),
                    )
                )

    with psycopg.connect("dbname=stardesk") as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            for extension in ("uuid-ossp", "pg_trgm", "vector"):
                cur.execute(
                    sql.SQL("CREATE EXTENSION IF NOT EXISTS {}").format(
                        sql.Identifier(extension)
                    )
                )


def write_api_database_url(user: str, password: str) -> None:
    if not API_ENV.exists():
        raise SystemExit(f"{API_ENV} not found — copy from .env.development.example first")

    database_url = (
        f"postgresql+asyncpg://{quote_plus(user)}:{quote_plus(password)}"
        "@localhost:5432/stardesk"
    )
    lines = _preserved_env_lines(API_ENV.read_text(encoding="utf-8"))
    lines.append(f"DATABASE_URL={database_url}")
    write_text_under_repo(API_ENV, "\n".join(lines) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Local PostgreSQL dev bootstrap helpers.")
    parser.add_argument(
        "command",
        choices=("setup", "write-env"),
        help="setup=role+db+extensions (run as postgres); write-env=patch apps/api/.env",
    )
    args = parser.parse_args()
    user, password = load_credentials()

    if args.command == "setup":
        setup_local_postgres(user, password)
        print(f"Local PostgreSQL ready ({user} @ localhost:5432/stardesk)")
    else:
        write_api_database_url(user, password)

    return 0


if __name__ == "__main__":
    sys.exit(main())
