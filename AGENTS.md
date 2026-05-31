# AGENTS.md

Guidance for AI agents working in **star-itsm-cloud** (STARDESK). See also `ARCHITECTURE.md` and `CLAUDE.md`.

## Cursor Cloud specific instructions

### Monorepo layout

| Path | Stack | Default port |
|------|--------|--------------|
| `apps/web` | Next.js 15, npm | 3000 |
| `apps/api` | FastAPI 3.12, **uv** (or `pip install -e ".[dev]"`) | 8000 |

Optional: `apps/project-kanban` (separate Neon DB, port 3001) — not required for core ITSM E2E.

### Dependency refresh (automatic on VM startup)

Handled by the VM **update script** (see Cursor Cloud env setup): `npm ci` in `apps/web`, `uv sync --group dev` in `apps/api`. Do not duplicate full install steps here.

### Environment files (create locally, never commit)

- **API:** `apps/api/.env` from `apps/api/.env.example` — `DATABASE_URL` must use `postgresql+asyncpg://…`
- **Web:** `apps/web/.env.local` from `apps/web/.env.example` — `NEXT_PUBLIC_API_URL=http://localhost:8000`

For demo login in the UI: `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` (see root `.env.example`).

### Database (required for real E2E)

Production/test clones use **Neon** (`DATABASE_URL` secret). The repo has **no** Postgres service in `docker-compose.yml`.

**If `DATABASE_URL` is set (Neon or other):**

```bash
cd apps/api && uv run python ../../scripts/run_neon_setup.py   # idempotent schema + seeds
cd apps/api && uv run alembic upgrade head                       # after SQL setup; see note below
```

**If no `DATABASE_URL` (local Postgres on the VM):**

1. Install PostgreSQL 16 + `postgresql-16-pgvector`.
2. Create role/db (example): user `stardesk` / password `stardesk_dev` / database `stardesk`.
3. As `postgres` superuser on that DB: `CREATE EXTENSION` for `uuid-ossp`, `pg_trgm`, `vector`.
4. `export DATABASE_URL=postgresql://stardesk:stardesk_dev@localhost:5432/stardesk` and run `scripts/run_neon_setup.py` via `uv run` from `apps/api`.
5. **Alembic:** SQL in `run_neon_setup.py` overlaps early Alembic revisions. If `alembic upgrade head` fails with “column already exists”, stamp through the SQL-covered revisions then upgrade:

   ```bash
   cd apps/api && source .env
   uv run alembic stamp 20260521_ui_mode
   uv run alembic upgrade head
   ```

Demo password after seeds: **`Stardesk2026!`** (e.g. `sf01@example.dk`).

### Run services (use tmux for long-lived dev servers)

```bash
# API
cd apps/api && source .env && uv run uvicorn star_itsm_api.main:app --reload --host 0.0.0.0 --port 8000

# Web
cd apps/web && npm run dev -- --hostname 0.0.0.0 --port 3000
```

Health: `GET http://localhost:8000/health` (no auth). Web proxies backend health at `/api/backend-health`.

### Verify (standard commands)

| Check | Command |
|-------|---------|
| API tests | `cd apps/api && uv run pytest` (unit tests mock DB; no Neon required) |
| Web lint | `cd apps/web && npm run lint` |
| Web build | `cd apps/web && npm run build` |

### Gotchas

- **Do not deploy from repo root** — Vercel root directories are `apps/web` and `apps/api` separately.
- **Alembic does not run on API cold start** on Vercel; migrations are CI/manual.
- **`npm run dev` hot reload** does not always pick up new env vars — restart the dev server after changing `.env.local`.
- Neon MCP / Vercel MCP may show `needsAuth` in Cloud Agents; use repo secrets or local Postgres as above.
