#!/usr/bin/env bash
# Mandatory deliverable gate — run before marking any task/PR complete.
# See docs/deliverable-gate.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FULL=0
SKIP_API=0
SKIP_TESTS=0

for arg in "$@"; do
  case "$arg" in
    --full) FULL=1 ;;
    --api-only) FULL=0 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    -h|--help)
      head -20 "$0" | tail -n +2
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

export PATH="${HOME}/.local/bin:${PATH}"

resolve_prototype_demo_password() {
  if [[ -n "${TEST_USER_PASSWORD:-}" ]]; then
    return 0
  fi
  cd "$ROOT/apps/api"
  set -a
  # shellcheck disable=SC1091
  [[ -f .env ]] && source .env
  set +a
  if [[ -z "${PROTOTYPE_BOOTSTRAP_PASSWORD:-}" ]]; then
    echo "PROTOTYPE_BOOTSTRAP_PASSWORD missing in apps/api/.env (see .env.development.example)" >&2
    exit 1
  fi
  export TEST_USER_PASSWORD="${PROTOTYPE_BOOTSTRAP_PASSWORD}"
}

echo "=============================================="
echo " STARDESK deliverable gate (hello-world)"
echo "=============================================="

if [[ "$SKIP_TESTS" -eq 0 ]]; then
  echo ""
  echo "==> API unit tests (quick)"
  cd "$ROOT/apps/api"
  set -a
  # shellcheck disable=SC1091
  [[ -f .env ]] && source .env
  set +a
  uv run pytest -q --tb=line 2>&1 | tail -5
fi

echo ""
resolve_prototype_demo_password
bash "$ROOT/scripts/hello-world-gate-api.sh"

if [[ "$FULL" -eq 1 ]]; then
  echo ""
  if [[ ! -d "$ROOT/scripts/node_modules/playwright" ]]; then
    echo "==> Installing Playwright (scripts/)"
    npm --prefix "$ROOT/scripts" install --no-audit --no-fund
    npx --prefix "$ROOT/scripts" playwright install chromium
  fi
  node "$ROOT/scripts/hello-world-gate.mjs"
fi

echo ""
echo "=============================================="
echo " DELIVERABLE GATE PASSED"
echo " Attach this output (+ screenshots if --full) to your PR/handoff."
echo "=============================================="
