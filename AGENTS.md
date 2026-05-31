# AGENTS.md

Guidance for AI agents in **star-itsm-cloud** (STARDESK). See `ARCHITECTURE.md`, `CLAUDE.md`, and `docs/environments.md`.

## Cursor Cloud specific instructions

### Goal: production parity, clearly not production

| Signal | Local development | Production |
|--------|-------------------|------------|
| `STARDESK_ENV` / `NEXT_PUBLIC_STARDESK_ENV` | `development` | `production` |
| `APP_ENV` | `development` | `production` |
| UI | Amber banner **Lokal udvikling** | No banner |
| `GET /health` | `deployment: local`, `stardesk_env: development` | `deployment: production`, `stardesk_env: production` |
| URLs | `localhost:3000` / `8000` | Vercel prod URLs |
| Demo login | `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` | `false` |
| Integrations | `SLACK_MOCK=1`, `GMAIL_MOCK=1` | Real OAuth |

Templates: `apps/api/.env.development.example`, `apps/web/.env.development.example`  
Manifest: `deploy/vercel/env-manifest.json`

### One-shot setup (recommended)

```bash
bash scripts/setup-dev-environment.sh --local-postgres   # VM without Neon
bash scripts/setup-dev-environment.sh                  # uses DATABASE_URL in apps/api/.env
bash scripts/dev-up.sh                                 # tmux: API :8000 + Web :3000
```

### VM update script (deps only)

`npm ci` in `apps/web`, then `uv sync --group dev` in `apps/api`.

### Database

```bash
bash scripts/bootstrap-dev-database.sh [--local-postgres]
```

Skips SQL if DB already seeded; always syncs Alembic via `alembic_after_sql_setup.py`. Demo password: **`Stardesk2026!`**.

### Deliverable gate (required before every handoff/PR)

All deliverables must pass the **hello-world gate** (login + tickets + non-prod identity):

```bash
bash scripts/run-deliverable-gate.sh          # API (required)
bash scripts/run-deliverable-gate.sh --full   # + Playwright /tickets (UI changes)
```

See **`docs/deliverable-gate.md`** and skill **`.cursor/skills/stardesk-deliverable-gate/SKILL.md`**.

### Verify production distinguishability

```bash
curl -s http://localhost:8000/health | jq .

cd apps/api && uv run pytest -q
cd apps/web && npm run lint && npm run build
```

Open http://localhost:3000 — confirm **Lokal udvikling** banner and page title suffix `[dev]`.

### Gotchas

- Never point local `.env` at Neon **`main`** (production branch).
- Use Neon **`test`** branch + `.env.test.example` for prod-like cloud data without prod risk.
- `APP_ENV=production` locally triggers strict secret checks — keep `development` locally.
- Alembic not on Vercel cold start; use `scripts/migrate-db.sh` or bootstrap.
