#!/usr/bin/env bash
# Safe .env loader for bash — ignores comments, strips UTF-8 BOM (Windows PowerShell writes BOM).
# Usage: source scripts/lib/source-dotenv.sh && stardesk_source_dotenv path/to/.env

stardesk_source_dotenv() {
  local env_file="${1:?env file path required}"
  [[ -f "$env_file" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line//$'\ufeff'/}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
    export "$line"
  done < "$env_file"
}
