#!/usr/bin/env bash
# Write scripts/sonar-agent/.env from shell/VM secret (SonarCloud PAT).
# Never commits secrets — only updates local gitignored .env
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SONAR_ENV="$ROOT/scripts/sonar-agent/.env"
EXAMPLE="$ROOT/scripts/sonar-agent/.env.example"

TOKEN="${SONAR_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  echo "Set SONAR_TOKEN (SonarCloud personal access token) in the environment or Cursor Cloud Agent secrets." >&2
  exit 1
fi

PROJECT_KEY="${SONAR_PROJECT_KEY:-LarrySAIndersen_STARDESK}"
HOST_URL="${SONAR_HOST_URL:-https://sonarcloud.io}"
NEW_CODE_ONLY="${SONAR_NEW_CODE_ONLY:-1}"

HOST_URL="${HOST_URL%/}"

[[ -f "$SONAR_ENV" ]] || cp "$EXAMPLE" "$SONAR_ENV"

export SONAR_TOKEN="$TOKEN"
export SONAR_PROJECT_KEY="$PROJECT_KEY"
export SONAR_HOST_URL="$HOST_URL"
export SONAR_NEW_CODE_ONLY="$NEW_CODE_ONLY"

python3 <<PY
from pathlib import Path
import os

env_path = Path("$SONAR_ENV")
token = os.environ["SONAR_TOKEN"]
project_key = os.environ["SONAR_PROJECT_KEY"]
host_url = os.environ["SONAR_HOST_URL"]
new_code_only = os.environ.get("SONAR_NEW_CODE_ONLY", "1")

keys = {
    "SONAR_HOST_URL": host_url,
    "SONAR_TOKEN": token,
    "SONAR_PROJECT_KEY": project_key,
    "SONAR_NEW_CODE_ONLY": new_code_only,
}

lines = env_path.read_text(encoding="utf-8").splitlines() if env_path.exists() else []
out = []
seen = set()
for line in lines:
    if not line.strip() or line.strip().startswith("#"):
        out.append(line)
        continue
    if "=" not in line:
        out.append(line)
        continue
    key = line.split("=", 1)[0].strip()
    if key in keys:
        out.append(f"{key}={keys[key]}")
        seen.add(key)
    else:
        out.append(line)

for key, value in keys.items():
    if key not in seen:
        out.append(f"{key}={value}")

env_path.write_text("\n".join(out).rstrip() + "\n", encoding="utf-8")
PY

echo "Updated $SONAR_ENV (SONAR_PROJECT_KEY=$PROJECT_KEY, SONAR_HOST_URL=$HOST_URL)."
echo "SONAR_TOKEN length: ${#TOKEN}"
