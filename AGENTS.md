# AGENTS.md

Guidance for AI agents in **star-itsm-cloud** (STARDESK). See `ARCHITECTURE.md`, `CLAUDE.md`, `docs/environments.md`.

## PR-only periode (aktiv — alle ændringer)

**`docs/pr-only-period.md`** — gælder indtil andet aftales.

- **FORBUDT:** `git push` til `main` eller `staging`.
- **KRAV:** feature-gren → **PR mod `staging`** → auto-merge (CI grøn) → prod kun Jan via PR `staging` → `main`.
- Afslut altid med **link til PR** i summary — ikke "committed to main".

## Git / release

- Default branch for work: **`staging`** (not `main`).
- Open PRs with **base `staging`**; auto-merge when CI passes (`.github/workflows/auto-merge-staging.yml`).
- **Work Board er pensioneret** — brug ikke `docs/workboard-agent-prompt.md` eller canvas-kanban til agent-flow. Arbejd direkte fra brugerens chat + PR mod `staging`.

## Mandatory: deliverable gate (never skip)

**Before every final response, PR, or handoff:**

```bash
bash scripts/run-deliverable-gate.sh
```

Add `--full` for web/UI/auth changes. Your summary **must** include `Deliverable gate: PASSED` and the command output. If you cannot run it, stop and say what is blocking (DB URL, servers down) — do not claim done.

Rule: `.cursor/rules/deliverable-gate.mdc` · Skill: `.cursor/skills/stardesk-deliverable-gate/SKILL.md` · Doc: `docs/deliverable-gate.md`

## Cursor Cloud specific instructions

### Database: Neon first (not local Postgres)

| Target | Neon branch | `STARDESK_ENV` | Use when |
|--------|-------------|----------------|----------|
| **Local dev (default)** | **`test`** | `test` or `development` | Cloud Agent VM, daily work |
| Production | `main` | `production` | Vercel prod only — **never** in local `.env` |
| UAT | `prod-clone` | `prod-clone` | Rare; isolated copy |

**Required VM/repo secret:** `DATABASE_URL` = `postgresql+asyncpg://…` from Neon **`test`** branch (see [docs/environments.md](docs/environments.md)).
- **Sonar live-scan:** `SONAR_TOKEN` (SonarCloud PAT) in Cursor Cloud Agent secrets **or** gitignored `scripts/sonar-agent/.env`; optional in file/env: `SONAR_PROJECT_KEY=LarrySAIndersen_STARDESK`, `SONAR_HOST_URL=https://sonarcloud.io`

```bash
# 1) VM has DATABASE_URL → sync into gitignored .env
bash scripts/sync-neon-env.sh
bash scripts/sync-sonar-env.sh  # after SONAR_TOKEN is in Cloud Agent secrets

# 2) Full setup (deps + Neon bootstrap + Alembic)
bash scripts/setup-dev-environment.sh

# 3) Dev servers
bash scripts/dev-up.sh
```

**Fallback** (no Neon secret): `bash scripts/setup-dev-environment.sh --local-postgres`

### Production parity vs clearly not production

| Signal | Dev / test (Neon `test`) | Production |
|--------|--------------------------|------------|
| `STARDESK_ENV` | `test` or `development` | `production` |
| `APP_ENV` | `development` | `production` |
| UI banner | **Testmiljø** or **Lokal udvikling** | None |
| `GET /health` | `stardesk_env` ≠ `production` | `stardesk_env=production` |
| URLs | `localhost:3000` / `8000` | Vercel prod |
| Demo login | `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` | `false` |
| Integrations | `SLACK_MOCK=1`, `GMAIL_MOCK=1` | Real OAuth |

Templates: `apps/api/.env.development.example`, `apps/web/.env.development.example`  
Neon test: `apps/api/.env.test.example`, `apps/web/.env.test.example`  
Manifest: `deploy/vercel/env-manifest.json`

### VM update script (deps only)

```text
cd apps/web && npm ci
cd apps/api && uv sync --group dev
```

Does **not** run DB bootstrap (use `setup-dev-environment.sh` once per Neon branch reset).

### Database bootstrap

```bash
bash scripts/bootstrap-dev-database.sh          # uses apps/api/.env (Neon or local)
bash scripts/bootstrap-dev-database.sh --local-postgres   # fallback only
```

Idempotent: skips SQL if seeded; runs `alembic_after_sql_setup.py`. Demo password: **`Stardesk2026!`**.

### Deliverable gate (required before every handoff/PR)

```bash
bash scripts/run-deliverable-gate.sh
bash scripts/run-deliverable-gate.sh --full   # UI changes
```

See `docs/deliverable-gate.md` and `.cursor/skills/stardesk-deliverable-gate/SKILL.md`.

### Verify

```bash
curl -s http://localhost:8000/health   # stardesk_env=test|development, not production
cd apps/api && uv run pytest -q
cd apps/web && npm run lint && npm run build
bash scripts/run-deliverable-gate.sh
```

### STARDESK watchdog (VM)

Autonomous repair for Sonar loop + release path stalls. See **`docs/stardesk-watchdog.md`**.

```powershell
pwsh scripts/stardesk-watchdog.ps1 -Once -DryRun   # test
pwsh scripts/stardesk-watchdog.ps1                 # start (15 min interval)
pwsh scripts/stardesk-watchdog.ps1 -Stop           # stop
```

From `scripts/`: `npm run watchdog:start` / `watchdog:stop`.

### Gotchas

- **Never** put Neon **`main`** `DATABASE_URL` in `apps/api/.env` for agent work.
- `sync-neon-env.sh` sets `STARDESK_ENV=test` when URL is Neon.
- Alembic does not run on Vercel API cold start — CI/`migrate-db.sh`/bootstrap.
- Restart `npm run dev` after `.env.local` changes.
- Neon MCP may need IDE auth; `DATABASE_URL` secret is enough for bootstrap.
