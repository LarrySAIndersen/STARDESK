#!/usr/bin/env bash
# Staging Preview hello-world gate (same checks as local API gate).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${STARDESK_STAGING_API_URL:-https://api-git-staging-kjaerby-1628s-projects.vercel.app}"
export STARDESK_API_URL="${API_URL%/}"
export GATE_REQUIRE_NON_PROD=1

echo "=============================================="
echo " STARDESK hello-world gate (staging Preview)"
echo " API: $STARDESK_API_URL"
echo "=============================================="
echo ""

if [[ -z "${TEST_USER_PASSWORD:-}" ]]; then
  cd "$ROOT/apps/api"
  set -a
  # shellcheck disable=SC1091
  [[ -f .env ]] && source .env
  set +a
  if [[ -z "${PROTOTYPE_BOOTSTRAP_PASSWORD:-}" ]]; then
    echo "PROTOTYPE_BOOTSTRAP_PASSWORD missing in apps/api/.env" >&2
    exit 1
  fi
  export TEST_USER_PASSWORD="${PROTOTYPE_BOOTSTRAP_PASSWORD}"
fi

bash "$ROOT/scripts/hello-world-gate-api.sh"
echo "GATE PASSED (staging Preview hello-world)"
