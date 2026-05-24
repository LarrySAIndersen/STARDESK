#!/usr/bin/env bash
# Run from repo root or anywhere — applies Alembic migrations to DATABASE_URL.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/apps/api"
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi
alembic upgrade head
alembic current
