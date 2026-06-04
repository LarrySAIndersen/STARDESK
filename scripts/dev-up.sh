#!/usr/bin/env bash
# Start API + Web dev servers in tmux (production-like stack, local URLs).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"
# shellcheck source=scripts/lib/api-venv.sh
source "$ROOT/scripts/lib/api-venv.sh"
API_DIR="$ROOT/apps/api"
API_UVICORN="$(stardesk_api_venv_uvicorn "$API_DIR")"
TMUX=(tmux -f /exec-daemon/tmux.portal.conf)

SESSION_API="stardesk-api"
SESSION_WEB="stardesk-web"

start_session() {
  local name="$1"
  local dir="$2"
  local cmd="$3"
  if ! "${TMUX[@]}" has-session -t "=$name" 2>/dev/null; then
    "${TMUX[@]}" new-session -d -s "$name" -c "$dir" -- "${SHELL:-bash}" -l
  fi
  "${TMUX[@]}" send-keys -t "$name:0.0" "$cmd" C-m
}

start_session "$SESSION_API" "$API_DIR" \
  "export PATH=\"\$HOME/.local/bin:\$PATH\" && set -a && source .env && set +a && \"$API_UVICORN\" star_itsm_api.main:app --reload --host 0.0.0.0 --port 8000"

start_session "$SESSION_WEB" "$ROOT/apps/web" \
  'npm run dev -- --hostname 0.0.0.0 --port 3000'

echo "Waiting for services..."
for _ in $(seq 1 30); do
  if curl -sf http://localhost:8000/health >/dev/null 2>&1 && curl -sf -o /dev/null http://localhost:3000/ 2>&1; then
    break
  fi
  sleep 1
done

echo "API health:"
curl -s http://localhost:8000/health | python3 -m json.tool 2>/dev/null || echo "(API not ready)"
echo ""
echo "Web: http://localhost:3000"
echo "tmux attach -t $SESSION_API | $SESSION_WEB"
