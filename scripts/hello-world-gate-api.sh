#!/usr/bin/env bash
# API-only hello-world gate (login + list tickets + environment identity).
set -euo pipefail

API_URL="${STARDESK_API_URL:-http://localhost:8000}"
EMAIL="${TEST_USER_EMAIL:-sf01@example.dk}"
PASSWORD="${TEST_USER_PASSWORD:-Stardesk2026!}"
REQUIRE_NON_PROD="${GATE_REQUIRE_NON_PROD:-1}"

fail() {
  echo "GATE FAIL: $*" >&2
  exit 1
}

pass() {
  echo "GATE OK: $*"
}

echo "==> Hello-world gate (API) — $API_URL"

HEALTH="$(curl -sf "$API_URL/health" 2>/dev/null)" || fail "GET /health failed (is API running on $API_URL?)"

STARDESK_ENV="$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('stardesk_env',''))" 2>/dev/null || true)"
APP_ENV="$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('app_env',''))" 2>/dev/null || true)"
DEPLOYMENT="$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('deployment',''))" 2>/dev/null || true)"

echo "    health: stardesk_env=$STARDESK_ENV app_env=$APP_ENV deployment=$DEPLOYMENT"

if [[ "$REQUIRE_NON_PROD" == "1" ]] && [[ "$STARDESK_ENV" == "production" ]]; then
  fail "stardesk_env=production — use local/test target (see docs/deliverable-gate.md)"
fi

LOGIN_JSON="$(curl -sf -X POST "$API_URL/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")" || fail "POST /api/v1/auth/login failed for $EMAIL"

TOKEN="$(echo "$LOGIN_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")"
[[ -n "$TOKEN" ]] || fail "No access_token in login response"

pass "Login as $EMAIL"

TICKETS_JSON="$(curl -sf "$API_URL/api/v1/tickets?page=1&page_size=5" \
  -H "Authorization: Bearer $TOKEN")" || fail "GET /api/v1/tickets failed"

COUNT="$(echo "$TICKETS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if isinstance(data, list):
    print(len(data))
else:
    items = data.get('items') or data.get('data') or []
    print(len(items) if isinstance(items, list) else 0)
")"

[[ "${COUNT:-0}" -ge 1 ]] || fail "Expected at least 1 ticket (got $COUNT). Run bootstrap-dev-database.sh?"

pass "Tickets listed (count=$COUNT)"
echo "GATE PASSED (API hello-world)"
