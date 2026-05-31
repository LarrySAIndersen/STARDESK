#!/usr/bin/env bash
# Write apps/api/.env DATABASE_URL from shell/VM secret (Neon test branch).
# Never commits secrets — only updates local gitignored .env
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_ENV="$ROOT/apps/api/.env"
WEB_ENV="$ROOT/apps/web/.env.local"

URL="${DATABASE_URL:-${STARDESK_NEON_DATABASE_URL:-}}"
if [[ -z "$URL" ]]; then
  echo "Set DATABASE_URL or STARDESK_NEON_DATABASE_URL (postgresql+asyncpg://… Neon test branch)." >&2
  exit 1
fi

if [[ "$URL" != *asyncpg* ]]; then
  URL="${URL/postgresql:\/\//postgresql+asyncpg:\/\/}"
fi

HOST="$(python3 -c "from urllib.parse import urlparse; u='${URL/postgresql+asyncpg:\/\//postgresql:\/\/}'; print(urlparse(u).hostname or '')")"

if [[ "$HOST" == *neon.tech* ]] || [[ "$HOST" == *neon.database* ]]; then
  echo "Neon host: $HOST"
  if [[ "$HOST" == *"ep-"*"main"* ]] || [[ "${STARDESK_ENV:-}" == "production" ]]; then
    echo "WARNING: This looks like production Neon. Prefer the **test** branch URL." >&2
  fi
else
  echo "Note: DATABASE_URL host is not Neon ($HOST) — using as-is for local/custom Postgres."
fi

[[ -f "$API_ENV" ]] || cp "$ROOT/apps/api/.env.development.example" "$API_ENV"
[[ -f "$WEB_ENV" ]] || cp "$ROOT/apps/web/.env.development.example" "$WEB_ENV"

export DATABASE_URL="$URL"
export STARDESK_NEON_DATABASE_URL="$URL"

python3 <<PY
from pathlib import Path
import os

api = Path("$API_ENV")
url = os.environ.get("DATABASE_URL") or os.environ.get("STARDESK_NEON_DATABASE_URL", "")
if "asyncpg" not in url:
    url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

lines = api.read_text(encoding="utf-8").splitlines()
out = []
seen_db = seen_stardesk = False
for line in lines:
    if line.startswith("DATABASE_URL="):
        out.append(f"DATABASE_URL={url}")
        seen_db = True
    elif line.startswith("STARDESK_ENV="):
        out.append("STARDESK_ENV=test")
        seen_stardesk = True
    else:
        out.append(line)
if not seen_db:
    out.append(f"DATABASE_URL={url}")
if not seen_stardesk:
    out.append("STARDESK_ENV=test")
api.write_text("\n".join(out) + "\n", encoding="utf-8")
PY

# Web: mark test when using Neon
if grep -q '^NEXT_PUBLIC_STARDESK_ENV=' "$WEB_ENV" 2>/dev/null; then
  sed -i 's/^NEXT_PUBLIC_STARDESK_ENV=.*/NEXT_PUBLIC_STARDESK_ENV=test/' "$WEB_ENV"
else
  echo "NEXT_PUBLIC_STARDESK_ENV=test" >> "$WEB_ENV"
fi

echo "Updated $API_ENV and $WEB_ENV (STARDESK_ENV=test for Neon)."
