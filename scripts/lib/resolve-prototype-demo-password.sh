#!/usr/bin/env bash
# Resolve TEST_USER_PASSWORD from env or apps/api/.env (no password literals in callers).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ -n "${TEST_USER_PASSWORD:-}" ]]; then
  printf '%s' "$TEST_USER_PASSWORD"
  exit 0
fi

node "$ROOT/scripts/lib/resolve-prototype-demo-password-cli.mjs"
