#!/usr/bin/env python3
"""Run prototype password reset using a Vercel-pulled env file only."""

from __future__ import annotations

import asyncio
import importlib.util
import os
import sys
from pathlib import Path

env_path = Path(sys.argv[1])
for line in env_path.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, _, value = line.partition("=")
    os.environ[key.strip()] = value.strip().strip('"')

script_dir = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "reset_prototype_passwords",
    script_dir / "reset-prototype-passwords.py",
)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)

if __name__ == "__main__":
    raise SystemExit(asyncio.run(module.main()))
