# STARdesk API

FastAPI backend for STARdesk. Deployed to **Vercel serverless** (`index.py` + `vercel.json`).

**Production URL:** https://api-gamma-amber.vercel.app

## Deploy

- Vercel project with root directory `apps/api`
- `DATABASE_URL` from Neon (`postgresql+asyncpg://…`) in Vercel env vars
- Alembic migrations run via CI or manually — **not** at cold start (see [docs/deploy.md](../../docs/deploy.md))

## Local (optional)

Requires Python 3.12+ and [uv](https://docs.astral.sh/uv/).

```bash
cd apps/api
uv sync --group dev
uv run pytest
uv run pytest --cov=star_itsm_api --cov-report=term-missing --cov-report=xml:coverage.xml
uv run uvicorn star_itsm_api.main:app --reload --port 8000
```

Coverage XML is written to `apps/api/coverage.xml` (gitignored). See [docs/test-coverage.md](../../docs/test-coverage.md) for CI and SonarCloud import.

Copy `.env.example` to `.env` and set `DATABASE_URL` when Neon is ready.
