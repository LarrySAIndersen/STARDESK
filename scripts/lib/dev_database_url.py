"""Shared DATABASE_URL resolution for dev/bootstrap scripts."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def normalize_database_url(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql://")


def load_database_url() -> str:
    from_env = os.environ.get("DATABASE_URL", "").strip()
    if from_env:
        return normalize_database_url(from_env)

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
                    return normalize_database_url(url)
    raise SystemExit("DATABASE_URL not found")
