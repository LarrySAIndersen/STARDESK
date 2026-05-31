#!/usr/bin/env bash
# Bootstrap STARDESK database for local Cloud Agent / dev VMs.
# - Neon: set DATABASE_URL (or apps/api/.env) and run without --local-postgres
# - No DB: use --local-postgres to install PostgreSQL 16 + pgvector and create stardesk DB
#
# Usage (from repo root):
#   bash scripts/bootstrap-dev-database.sh
#   bash scripts/bootstrap-dev-database.sh --local-postgres
#   bash scripts/bootstrap-dev-database.sh --migrations-only
#   bash scripts/bootstrap-dev-database.sh --no-alembic
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

LOCAL_POSTGRES=0
MIGRATIONS_ONLY=0
WITH_ALEMBIC=1
WRITE_ENV=1
FORCE_SQL=0

for arg in "$@"; do
  case "$arg" in
    --local-postgres) LOCAL_POSTGRES=1 ;;
    --migrations-only) MIGRATIONS_ONLY=1 ;;
    --no-alembic) WITH_ALEMBIC=0 ;;
    --no-write-env) WRITE_ENV=0 ;;
    --force-sql) FORCE_SQL=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

export PATH="${HOME}/.local/bin:${PATH}"

ensure_uv() {
  if command -v uv >/dev/null 2>&1; then
    return 0
  fi
  echo "Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="${HOME}/.local/bin:${PATH}"
}

write_dev_env_files() {
  if [[ "$WRITE_ENV" -ne 1 ]]; then
    return 0
  fi
  if [[ ! -f "$ROOT/apps/api/.env" ]]; then
    cp "$ROOT/apps/api/.env.development.example" "$ROOT/apps/api/.env"
    if [[ "$LOCAL_POSTGRES" -eq 1 ]]; then
      sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgresql+asyncpg://stardesk:stardesk_dev@localhost:5432/stardesk|' \
        "$ROOT/apps/api/.env"
    fi
    echo "Created apps/api/.env from .env.development.example"
  fi
  if [[ ! -f "$ROOT/apps/web/.env.local" ]]; then
    cp "$ROOT/apps/web/.env.development.example" "$ROOT/apps/web/.env.local"
    echo "Created apps/web/.env.local from .env.development.example"
  fi
}

setup_local_postgres() {
  if ! command -v psql >/dev/null 2>&1; then
    echo "Installing PostgreSQL 16..."
    sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
      postgresql postgresql-contrib postgresql-16-pgvector
  fi
  sudo pg_ctlcluster 16 main start 2>/dev/null || sudo service postgresql start 2>/dev/null || true

  sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'stardesk') THEN
    CREATE ROLE stardesk WITH LOGIN PASSWORD 'stardesk_dev' CREATEDB;
  END IF;
END
$$;
SELECT 'CREATE DATABASE stardesk OWNER stardesk'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'stardesk')\gexec
SQL

  sudo -u postgres psql -d stardesk -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
SQL
  echo "Local PostgreSQL ready (stardesk / stardesk_dev @ localhost:5432/stardesk)"
}

ensure_uv
if [[ "$LOCAL_POSTGRES" -eq 1 ]]; then
  setup_local_postgres
fi

write_dev_env_files

cd "$ROOT/apps/api"
uv sync --group dev

NEON_ARGS=()
if [[ "$MIGRATIONS_ONLY" -eq 1 ]]; then
  NEON_ARGS+=(--migrations-only)
fi

set -a
# shellcheck disable=SC1091
[[ -f .env ]] && source .env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Use --local-postgres or configure apps/api/.env" >&2
  exit 1
fi

SKIP_SQL=0
if [[ "$FORCE_SQL" -ne 1 ]]; then
  if uv run python "$ROOT/scripts/db_bootstrap_status.py"; then
    echo "Database already has schema and users — skipping SQL migrations/seeds."
    echo "  (use --force-sql to re-run run_neon_setup.py)"
    SKIP_SQL=1
  fi
fi

if [[ "$SKIP_SQL" -eq 0 ]]; then
  echo "Running SQL setup (run_neon_setup.py)..."
  uv run python "$ROOT/scripts/run_neon_setup.py" "${NEON_ARGS[@]}"
fi

if [[ "$WITH_ALEMBIC" -eq 1 ]]; then
  echo "Syncing Alembic revisions..."
  uv run python "$ROOT/scripts/alembic_after_sql_setup.py"
fi

echo "Database bootstrap complete."
