#!/usr/bin/env bash
# API-only hello-world gate (login + list tickets + environment identity).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${STARDESK_API_URL:-http://localhost:8000}"
EMAIL="${TEST_USER_EMAIL:-sf01@example.dk}"
REQUIRE_NON_PROD="${GATE_REQUIRE_NON_PROD:-1}"

# shellcheck source=scripts/lib/gate-json.sh
source "$ROOT/scripts/lib/gate-json.sh"
GATE_PYTHON="$(stardesk_gate_python "$ROOT")"

if [[ -z "${TEST_USER_PASSWORD:-}" ]]; then
  export TEST_USER_PASSWORD
  TEST_USER_PASSWORD="$(bash "$ROOT/scripts/lib/resolve-prototype-demo-password.sh")"
fi
PASSWORD="$TEST_USER_PASSWORD"

fail() {
  echo "GATE FAIL: $*" >&2
  exit 1
}

pass() {
  echo "GATE OK: $*"
}

curl_gate() {
  # Optional Vercel Preview deployment protection (see docs/staging-vercel-preview-env.md).
  if [[ -n "${VERCEL_PROTECTION_BYPASS:-}" ]]; then
    curl -sf -H "x-vercel-protection-bypass: ${VERCEL_PROTECTION_BYPASS}" "$@"
  else
    curl -sf "$@"
  fi
}

echo "==> Hello-world gate (API) — $API_URL"

HEALTH="$(curl_gate "$API_URL/health" 2>/dev/null)" || fail "GET /health failed (is API running on $API_URL?)"

STARDESK_ENV="$(stardesk_json_field "$GATE_PYTHON" stardesk_env "$HEALTH")"
APP_ENV="$(stardesk_json_field "$GATE_PYTHON" app_env "$HEALTH")"
DEPLOYMENT="$(stardesk_json_field "$GATE_PYTHON" deployment "$HEALTH")"

echo "    health: stardesk_env=$STARDESK_ENV app_env=$APP_ENV deployment=$DEPLOYMENT"

if [[ "$REQUIRE_NON_PROD" == "1" ]] && [[ "$STARDESK_ENV" == "production" ]]; then
  fail "stardesk_env=production — use local/test target (see docs/deliverable-gate.md)"
fi

LOGIN_JSON="$(curl_gate -X POST "$API_URL/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")" || fail "POST /api/v1/auth/login failed for $EMAIL"

TOKEN="$(stardesk_json_field "$GATE_PYTHON" access_token "$LOGIN_JSON")"
[[ -n "$TOKEN" ]] || fail "No access_token in login response"

pass "Login as $EMAIL"

TICKETS_JSON="$(curl_gate "$API_URL/api/v1/tickets?page=1&page_size=5" \
  -H "Authorization: Bearer $TOKEN")" || fail "GET /api/v1/tickets failed"

COUNT="$(stardesk_json_ticket_count "$GATE_PYTHON" "$TICKETS_JSON")"

[[ "${COUNT:-0}" -ge 1 ]] || fail "Expected at least 1 ticket (got $COUNT). Run bootstrap-dev-database.sh?"

pass "Tickets listed (count=$COUNT)"
echo "GATE PASSED (API hello-world)"
