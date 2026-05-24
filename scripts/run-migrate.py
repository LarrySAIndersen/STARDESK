#!/usr/bin/env python3
"""Apply Alembic migrations using DATABASE_URL from apps/api env files."""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
API_DIR = REPO_ROOT / "apps" / "api"
sys.path.insert(0, str(API_DIR / "src"))
os.chdir(API_DIR)

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore[assignment,misc]


def _load_database_url() -> str | None:
    candidates = (
        API_DIR / ".env.local",
        API_DIR / ".env",
        API_DIR / ".env.vercel.production",
        API_DIR / ".env.migrate.tmp",
    )
    if load_dotenv is not None:
        for path in candidates:
            if path.is_file():
                load_dotenv(path, override=True)
    url = os.environ.get("DATABASE_URL", "").strip().strip('"')
    if url:
        return url
    return None


def main() -> int:
    url = _load_database_url()
    if not url:
        print(
            "DATABASE_URL not found. Run: cd apps/api && vercel env pull .env.migrate.tmp "
            "--environment=production --yes",
            file=sys.stderr,
        )
        return 1
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://") and "+asyncpg" not in url:
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    os.environ["DATABASE_URL"] = url

    from star_itsm_api.db_alembic import run_alembic_upgrade_head

    run_alembic_upgrade_head()
    print("migrate: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
