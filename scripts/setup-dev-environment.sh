#!/usr/bin/env bash
# Full local dev environment: deps, prod-parity env files, database, verification.
# Result is clearly non-production (STARDESK_ENV=development, UI banner, /health fields).
#
# Usage (repo root):
#   bash scripts/setup-dev-environment.sh
#   bash scripts/setup-dev-environment.sh --local-postgres
#   bash scripts/setup-dev-environment.sh --skip-db
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LOCAL_POSTGRES=0
SKIP_DB=0
BOOTSTRAP_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --local-postgres) LOCAL_POSTGRES=1 ;;
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
cd "$ROOT/apps/web" && npm ci
cd "$ROOT/apps/api" && uv sync --group dev

echo "==> Writing development env files (production variable parity, local values)"
if [[ ! -f "$ROOT/apps/api/.env" ]]; then
  cp "$ROOT/apps/api/.env.development.example" "$ROOT/apps/api/.env"
  echo "    apps/api/.env"
fi
if [[ ! -f "$ROOT/apps/web/.env.local" ]]; then
  cp "$ROOT/apps/web/.env.development.example" "$ROOT/apps/web/.env.local"
  echo "    apps/web/.env.local"
fi

if [[ "$SKIP_DB" -eq 0 ]]; then
  BOOTSTRAP_ARGS=()
  [[ "$LOCAL_POSTGRES" -eq 1 ]] && BOOTSTRAP_ARGS+=(--local-postgres)
  echo "==> Database bootstrap"
  bash "$ROOT/scripts/bootstrap-dev-database.sh" --no-write-env "${BOOTSTRAP_ARGS[@]}"
fi

echo "==> API unit tests"
cd "$ROOT/apps/api"
set -a
# shellcheck disable=SC1091
[[ -f .env ]] && source .env
set +a
uv run pytest -q --tb=no -q 2>&1 | tail -3

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
echo "  Demo: sf01@example.dk / Stardesk2026!"
