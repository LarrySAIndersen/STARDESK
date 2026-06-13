#!/usr/bin/env python3
"""Load a Vercel-pulled env file and print DB target (no secrets)."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse


def load_env_file(path: Path) -> None:
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"')
        os.environ[key] = value


def main() -> int:
    env_path = Path(sys.argv[1])
    load_env_file(env_path)
    url = os.environ.get("DATABASE_URL", "")
    parsed = urlparse(url.replace("postgresql+asyncpg://", "postgresql://"))
    print(f"STARDESK_ENV={os.environ.get('STARDESK_ENV')!r}")
    print(f"PROTOTYPE_SET={bool(os.environ.get('PROTOTYPE_BOOTSTRAP_PASSWORD'))}")
    print(f"DB_HOST={parsed.hostname}")
    print(f"DB_NAME={parsed.path.lstrip('/')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
