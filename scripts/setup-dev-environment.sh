#!/usr/bin/env bash
# Full local dev environment: deps, prod-parity env files, database, verification.
# Result is clearly non-production (STARDESK_ENV=development, UI banner, /health fields).
#
# Usage (repo root):
#   bash scripts/setup-dev-environment.sh              # Neon if DATABASE_URL set, else local Postgres
#   bash scripts/setup-dev-environment.sh --neon-only    # require DATABASE_URL (Neon test branch)
#   bash scripts/setup-dev-environment.sh --local-postgres
#   bash scripts/setup-dev-environment.sh --skip-db
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/lib/api-venv.sh
source "$ROOT/scripts/lib/api-venv.sh"
API_DIR="$ROOT/apps/api"

LOCAL_POSTGRES=0
NEON_ONLY=0
SKIP_DB=0
BOOTSTRAP_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --local-postgres) LOCAL_POSTGRES=1 ;;
    --neon-only) NEON_ONLY=1 ;;
    --skip-db) SKIP_DB=1 ;;
    -h|--help)
      grep '^#' "$0" | head -12
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

export PATH="${HOME}/.local/bin:${PATH}"

echo "==> Installing dependencies"
cd "$ROOT/apps/web" && npm ci --ignore-scripts
cd "$API_DIR" && uv sync --group dev
API_VENV_PYTHON="$(stardesk_api_venv_python "$API_DIR")"
API_PYTEST="$(stardesk_api_venv_pytest "$API_DIR")"

echo "==> Environment files"
if [[ -n "${DATABASE_URL:-${STARDESK_NEON_DATABASE_URL:-}}" ]]; then
  echo "    Syncing Neon DATABASE_URL into apps/api/.env"
  bash "$ROOT/scripts/sync-neon-env.sh"
elif [[ "$NEON_ONLY" -eq 1 ]]; then
  echo "ERROR: --neon-only requires DATABASE_URL or STARDESK_NEON_DATABASE_URL" >&2
  exit 1
else
  if [[ ! -f "$ROOT/apps/api/.env" ]]; then
    cp "$ROOT/apps/api/.env.development.example" "$ROOT/apps/api/.env"
    echo "    Created apps/api/.env (local template)"
  fi
  if [[ ! -f "$ROOT/apps/web/.env.local" ]]; then
    cp "$ROOT/apps/web/.env.development.example" "$ROOT/apps/web/.env.local"
    echo "    Created apps/web/.env.local"
  fi
fi

if [[ "$SKIP_DB" -eq 0 ]]; then
  BOOTSTRAP_ARGS=(--no-write-env)
  if [[ "$LOCAL_POSTGRES" -eq 1 ]]; then
    BOOTSTRAP_ARGS+=(--local-postgres)
  elif [[ -z "${DATABASE_URL:-${STARDESK_NEON_DATABASE_URL:-}}" ]]; then
    BOOTSTRAP_ARGS+=(--local-postgres)
    echo "==> No Neon URL in env — bootstrapping local PostgreSQL"
  else
    echo "==> Database bootstrap (Neon)"
  fi
  bash "$ROOT/scripts/bootstrap-dev-database.sh" "${BOOTSTRAP_ARGS[@]}"
fi

echo "==> API unit tests"
cd "$API_DIR"
set -a
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/source-dotenv.sh"
stardesk_source_dotenv .env
set +a
"$API_PYTEST" -q --tb=no -q 2>&1 | tail -3

echo "==> Environment identity (compare to production)"
HEALTH="$(curl -sf http://localhost:8000/health 2>/dev/null || true)"
if [[ -n "$HEALTH" ]]; then
  echo "    API already running: $HEALTH"
else
  echo "    Start API/web: bash scripts/dev-up.sh"
  echo "    Expected /health: stardesk_env=development, deployment=local, app_env=development"
fi

echo ""
echo "Done. This is LOCAL DEVELOPMENT — not production."
echo "  Web:  http://localhost:3000  (banner: Lokal udvikling)"
echo "  API:  http://localhost:8000/health"
if [[ "$SKIP_DB" -eq 0 ]]; then
  echo "  Prototype users (from database):"
  cd "$API_DIR"
  "$API_VENV_PYTHON" "$ROOT/scripts/list_prototype_users.py" || true
fi
