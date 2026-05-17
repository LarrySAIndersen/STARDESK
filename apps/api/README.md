# STARdesk API

FastAPI backend for STARdesk. Deployed to Railway.

## Local (optional)

Requires Python 3.12+ and [uv](https://docs.astral.sh/uv/).

```bash
cd apps/api
uv sync --group dev
uv run pytest
uv run uvicorn star_itsm_api.main:app --reload --port 8000
```

Copy `.env.example` to `.env` and set `DATABASE_URL` when Neon is ready.
