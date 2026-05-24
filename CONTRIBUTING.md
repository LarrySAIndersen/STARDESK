# Contributing to STARdesk

Focused guide for developers working in this monorepo (`apps/web` + `apps/api`).

## Prerequisites

- Node.js 20+ (for `apps/web`)
- Python 3.12+ (for `apps/api`)
- A Neon PostgreSQL database (see [docs/environments.md](./docs/environments.md))

## Environment setup

| App | Local env file | Template |
|-----|----------------|----------|
| Web | `apps/web/.env.local` | `apps/web/.env.example` |
| API | `apps/api/.env` or `.env.local` | `apps/api/.env.example` |

**Cloud / test / prod-klon:** use the per-target examples listed in [docs/environments.md](./docs/environments.md) — do not commit filled `.env` files.

Root [`.env.example`](./.env.example) is a combined overview for local dev only.

## Run locally

### API (FastAPI)

```powershell
cd apps\api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
# Set DATABASE_URL (postgresql+asyncpg://…) in .env
uvicorn star_itsm_api.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health`

### Web (Next.js)

```powershell
cd apps\web
npm install
# apps/web/.env.local → NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000

## Verify changes

```powershell
cd apps\web
npm run build

cd ..\api
pytest
```

## Database migrations

Schema changes live in `apps/api/alembic/versions/`. After merge to `main`:

1. CI runs `alembic upgrade head` (needs repo secret `DATABASE_URL`).
2. API redeploy runs the same on startup.

Local:

```powershell
cd apps\api
$env:DATABASE_URL = "postgresql+asyncpg://..."
alembic upgrade head
```

Or from repo root: `bash scripts/migrate-db.sh` (Git Bash / WSL).

## Deploy (Vercel)

- **Do not** deploy from the repository root. Set **Root Directory** to `apps/web` or `apps/api` per project.
- Per-app config: `apps/web/vercel.json`, `apps/api/vercel.json`
- Root `vercel.json` (`experimentalServices`) is not used by the standard two-project setup; see [docs/deploy.md](./docs/deploy.md).

## Code conventions

- Web imports: prefer `@/` aliases (`@/components/…`, `@/lib/…`).
- Keep mock/demo data (`mock-assets`, API `*_mock` modules) unless replacing with real persistence.
- Do not commit secrets, `.env.local`, or `Background/` notes.

## Related docs

- [docs/environments.md](./docs/environments.md) — test vs prod vs prod-klon
- [docs/deploy.md](./docs/deploy.md) — first deploy checklist
- [docs/DOCUMENTATION.md](./docs/DOCUMENTATION.md) — full reference
