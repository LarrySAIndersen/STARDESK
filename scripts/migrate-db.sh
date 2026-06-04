#!/usr/bin/env bash
# Run from repo root — Alembic stamp (post-SQL) + upgrade to head.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"
cd "$ROOT/apps/api"
if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set (export it or use apps/api/.env)" >&2
  exit 1
fi
uv run --no-build python "$ROOT/scripts/alembic_after_sql_setup.py"
