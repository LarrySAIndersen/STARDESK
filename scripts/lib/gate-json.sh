#!/usr/bin/env bash
# JSON helpers for gate scripts — use API venv Python (Git Bash on Windows has no python3).

stardesk_gate_python() {
  local root="${1:?repo root required}"
  # shellcheck source=scripts/lib/api-venv.sh
  source "$root/scripts/lib/api-venv.sh"
  stardesk_api_venv_python "$root/apps/api"
}

stardesk_json_field() {
  local python="$1"
  local field="$2"
  local json="$3"
  printf '%s' "$json" | "$python" -c 'import sys,json; d=json.load(sys.stdin); print(d.get(sys.argv[1],""))' "$field"
}

stardesk_json_ticket_count() {
  local python="$1"
  local json="$2"
  printf '%s' "$json" | "$python" -c '
import sys, json
data = json.load(sys.stdin)
if isinstance(data, list):
    print(len(data))
else:
    items = data.get("items") or data.get("data") or []
    print(len(items) if isinstance(items, list) else 0)
'
}
