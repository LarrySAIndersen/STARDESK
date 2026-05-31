#!/usr/bin/env python3
"""Align Alembic with schema already applied via docs/*.sql (run_neon_setup.py).

SQL migrations in run_neon_setup.py duplicate Alembic revisions through
20260521_ui_mode. This script stamps that revision when needed, then upgrades to head.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_DIR = ROOT / "apps" / "api"

# Last Alembic revision whose DDL is covered by docs/*.sql in run_neon_setup.MIGRATIONS
STAMP_REVISION_AFTER_SQL = "20260521_ui_mode"


def _api_env() -> dict[str, str]:
    env = os.environ.copy()
    env_path = API_DIR / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in env:
                env[key] = value
    return env


def _run_alembic(*args: str) -> subprocess.CompletedProcess[str]:
    cmd = ["uv", "run", "alembic", *args]
    return subprocess.run(
        cmd,
        cwd=API_DIR,
        env=_api_env(),
        text=True,
        capture_output=True,
        check=False,
    )


def _current_revision() -> str | None:
    result = _run_alembic("current")
    if result.returncode != 0:
        stderr = (result.stderr or "") + (result.stdout or "")
        if "Can't locate revision" in stderr or "alembic_version" in stderr.lower():
            return None
        print(stderr, file=sys.stderr)
        return None
    for line in (result.stdout or "").splitlines():
        line = line.strip()
        if not line or line.startswith("INFO"):
            continue
        # e.g. "20260530_page_review_notes (head)" or "20260521_ui_mode"
        token = line.split()[0]
        if token and not token.startswith("("):
            return token
    return None


def _heads() -> list[str]:
    result = _run_alembic("heads")
    if result.returncode != 0:
        print(result.stderr or result.stdout, file=sys.stderr)
        return []
    heads: list[str] = []
    for line in (result.stdout or "").splitlines():
        line = line.strip()
        if not line or line.startswith("INFO"):
            continue
        token = line.split()[0]
        if token:
            heads.append(token)
    return heads


def main() -> int:
    if not _api_env().get("DATABASE_URL", "").strip():
        print(
            "DATABASE_URL is not set. Configure apps/api/.env or export DATABASE_URL.",
            file=sys.stderr,
        )
        return 1

    heads = _heads()
    if not heads:
        print("Could not read Alembic heads.", file=sys.stderr)
        return 1
    head_rev = heads[0]

    current = _current_revision()
    if current is None:
        print(f"No Alembic revision — stamping {STAMP_REVISION_AFTER_SQL} (post-SQL setup)")
        stamp = _run_alembic("stamp", STAMP_REVISION_AFTER_SQL)
        if stamp.returncode != 0:
            print(stamp.stderr or stamp.stdout, file=sys.stderr)
            return stamp.returncode
        current = STAMP_REVISION_AFTER_SQL

    if current == head_rev or (current and "head" in (current,)):
        print(f"Alembic already at head ({head_rev}).")
        return 0

    print(f"Upgrading Alembic: {current} -> {head_rev}")
    upgrade = _run_alembic("upgrade", "head")
    if upgrade.returncode != 0:
        print(upgrade.stderr or upgrade.stdout, file=sys.stderr)
        return upgrade.returncode

    verify = _run_alembic("current")
    print(verify.stdout or "", end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
