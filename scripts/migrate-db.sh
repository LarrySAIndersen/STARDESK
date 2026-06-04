#!/usr/bin/env bash
# Run from repo root — Alembic stamp (post-SQL) + upgrade to head.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"
# shellcheck source=scripts/lib/api-venv.sh
source "$ROOT/scripts/lib/api-venv.sh"
API_DIR="$ROOT/apps/api"
cd "$API_DIR"
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
API_VENV_PYTHON="$(stardesk_api_venv_python "$API_DIR")"
"$API_VENV_PYTHON" "$ROOT/scripts/alembic_after_sql_setup.py"
