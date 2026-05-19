#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${LOAD_TEST_BASE_URL:-${BASE_URL:-http://127.0.0.1:8000}}"

if [[ "${ALLOW_DESTRUCTIVE:-0}" != "1" ]]; then
  echo "Refusing schemathesis destructive run without ALLOW_DESTRUCTIVE=1"
  exit 1
fi

HOST="$(echo "$BASE_URL" | sed -E 's#^https?://([^/:]+).*#\1#')"
if [[ "$HOST" != "localhost" && "$HOST" != "127.0.0.1" && "$HOST" != "0.0.0.0" ]]; then
  echo "Proceeding against non-local target because ALLOW_DESTRUCTIVE=1 is set"
fi

if ! command -v schemathesis >/dev/null 2>&1; then
  echo "schemathesis is not installed. Install it before running this script."
  exit 2
fi

echo "Running capped Schemathesis destructive checks against ${BASE_URL}"
schemathesis run "${BASE_URL}/openapi.json" \
  --hypothesis-max-examples=50 \
  --stateful=none
