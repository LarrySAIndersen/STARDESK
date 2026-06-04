#!/usr/bin/env bash
# STARDESK watchdog — bash entrypoint (delegates to PowerShell on Windows, native checks on Linux).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORTS_DIR="$REPO_ROOT/reports"
WATCHDOG_PS1="$SCRIPT_DIR/stardesk-watchdog.ps1"

INTERVAL_MINUTES="${WATCHDOG_INTERVAL_MINUTES:-15}"
DRY_RUN=""
ONCE=""
STOP=""

usage() {
  cat <<'EOF'
STARDESK watchdog — monitors Sonar loop, git drift, and CI.

Usage:
  bash scripts/stardesk-watchdog.sh              # background loop (15 min)
  bash scripts/stardesk-watchdog.sh --once     # single check
  bash scripts/stardesk-watchdog.sh --dry-run  # log only, no repairs
  bash scripts/stardesk-watchdog.sh --stop     # stop background watchdog

Environment:
  WATCHDOG_INTERVAL_MINUTES  Check interval (default 15)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="-DryRun"; shift ;;
    --once) ONCE="-Once"; shift ;;
    --stop) STOP="-Stop"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

mkdir -p "$REPORTS_DIR"

if command -v pwsh >/dev/null 2>&1; then
  exec pwsh -NoProfile -ExecutionPolicy Bypass -File "$WATCHDOG_PS1" \
    -IntervalMinutes "$INTERVAL_MINUTES" $DRY_RUN $ONCE $STOP
fi

if command -v powershell >/dev/null 2>&1; then
  exec powershell -NoProfile -ExecutionPolicy Bypass -File "$WATCHDOG_PS1" \
    -IntervalMinutes "$INTERVAL_MINUTES" $DRY_RUN $ONCE $STOP
fi

echo "ERROR: PowerShell (pwsh) required for STARDESK watchdog." >&2
exit 1
