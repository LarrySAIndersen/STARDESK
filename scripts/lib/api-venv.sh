#!/usr/bin/env bash
# Resolve API venv executables (Linux Cloud Agent + Git Bash on Windows).
# Prefer venv binaries over `uv run --no-build`, which breaks editable star-itsm-api.

stardesk_api_venv_python() {
  local api_dir="${1:?api dir required}"
  if [[ -x "$api_dir/.venv/bin/python" ]]; then
    printf '%s\n' "$api_dir/.venv/bin/python"
  elif [[ -x "$api_dir/.venv/Scripts/python.exe" ]]; then
    printf '%s\n' "$api_dir/.venv/Scripts/python.exe"
  else
    echo "ERROR: API venv missing — run: cd apps/api && uv sync --group dev --no-build" >&2
    return 1
  fi
}

stardesk_api_venv_pytest() {
  local api_dir="${1:?api dir required}"
  if [[ -x "$api_dir/.venv/bin/pytest" ]]; then
    printf '%s\n' "$api_dir/.venv/bin/pytest"
  elif [[ -x "$api_dir/.venv/Scripts/pytest.exe" ]]; then
    printf '%s\n' "$api_dir/.venv/Scripts/pytest.exe"
  else
    echo "ERROR: pytest missing in API venv — run: cd apps/api && uv sync --group dev --no-build" >&2
    return 1
  fi
}

stardesk_api_venv_uvicorn() {
  local api_dir="${1:?api dir required}"
  if [[ -x "$api_dir/.venv/bin/uvicorn" ]]; then
    printf '%s\n' "$api_dir/.venv/bin/uvicorn"
  elif [[ -x "$api_dir/.venv/Scripts/uvicorn.exe" ]]; then
    printf '%s\n' "$api_dir/.venv/Scripts/uvicorn.exe"
  else
    echo "ERROR: uvicorn missing in API venv — run: cd apps/api && uv sync --group dev --no-build" >&2
    return 1
  fi
}
