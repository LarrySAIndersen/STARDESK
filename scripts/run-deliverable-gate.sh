#!/usr/bin/env bash
# Mandatory deliverable gate — run before marking any task/PR complete.
# See docs/deliverable-gate.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
GATE_BANNER='=============================================='

FULL=0
STAGING=0
SKIP_STAGING=0
SKIP_TESTS=0

for arg in "$@"; do
  case "$arg" in
    --full) FULL=1 ;;
    --staging) STAGING=1 ;;
    --skip-staging) SKIP_STAGING=1 ;;
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
  export TEST_USER_PASSWORD
  TEST_USER_PASSWORD="$(bash "$ROOT/scripts/lib/resolve-prototype-demo-password.sh")"
}

echo "$GATE_BANNER"
echo " STARDESK deliverable gate (hello-world)"
echo "$GATE_BANNER"

if [[ "$SKIP_TESTS" -eq 0 ]]; then
  echo ""
  echo "==> API unit tests (quick)"
  cd "$ROOT/apps/api"
  set -a
  # shellcheck disable=SC1091
  [[ -f .env ]] && source .env
  set +a
  uv run --no-build pytest -q --tb=line 2>&1 | tail -5
fi

echo ""
resolve_prototype_demo_password
bash "$ROOT/scripts/hello-world-gate-api.sh"

if [[ "$FULL" -eq 1 ]]; then
  echo ""
  if [[ ! -d "$ROOT/scripts/node_modules/playwright" ]]; then
    echo "==> Installing Playwright (scripts/)"
    npm --prefix "$ROOT/scripts" install --no-audit --no-fund --ignore-scripts
    npx --prefix "$ROOT/scripts" playwright install chromium
  fi
  node "$ROOT/scripts/hello-world-gate.mjs"
fi

RUN_STAGING=0
if [[ "$STAGING" -eq 1 && "$SKIP_STAGING" -eq 0 ]]; then
  RUN_STAGING=1
fi

if [[ "$RUN_STAGING" -eq 1 ]]; then
  echo ""
  bash "$ROOT/scripts/hello-world-gate-staging.sh"
  if [[ "$FULL" -eq 1 ]]; then
    echo ""
    export STARDESK_WEB_URL="${STARDESK_STAGING_WEB_URL:-https://web-git-staging-kjaerby-1628s-projects.vercel.app}"
    export STARDESK_API_URL="${STARDESK_STAGING_API_URL:-https://api-git-staging-kjaerby-1628s-projects.vercel.app}"
    echo "==> Hello-world gate (UI) — staging Preview — $STARDESK_WEB_URL"
    node "$ROOT/scripts/hello-world-gate.mjs"
  fi
fi

echo ""
echo "$GATE_BANNER"
if [[ "$RUN_STAGING" -eq 1 ]]; then
  echo " DELIVERABLE GATE PASSED (local + staging hello-world)"
else
  echo " DELIVERABLE GATE PASSED (local hello-world)"
  echo " Tip: after merge to staging, run with --staging for cloud Preview check."
fi
echo " Attach this output (+ screenshots if --full) to your PR/handoff."
echo "$GATE_BANNER"
