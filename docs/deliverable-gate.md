# Deliverable gate — hello-world (obligatorisk for alle leverancer)

Every **deliverable** (PR, Cloud Agent task, Work Board handoff) must pass the **hello-world gate** before it is considered done. This proves the STARDESK core path works end-to-end: **auth → ticket list** (same flow as production, on a non-production target).

## What the gate checks

| Step | API (fast) | UI (Playwright, `--full`) |
|------|------------|---------------------------|
| Environment is not confused with prod | `/health` → `stardesk_env` ≠ `production` when testing **local/test** | Amber/sky banner visible (not production) |
| Login works | `POST /api/v1/auth/login` (Anna `sf01@example.dk`) | Demo picker or email/password login |
| Tickets exist | `GET /api/v1/tickets` with JWT → ≥1 item | `/tickets` shows demo rows (e.g. `DEMO-`, `SF Operations`) |

**Hello-world control (local + cloud):** run local gate first, then **staging Vercel Preview** with `--staging` / `-Staging` after merge to `staging` or before prod release.

**Default demo user:** `sf01@example.dk` / `Stardesk2026!` (see `apps/web/src/lib/demo-users.ts`).

## Commands (run before you say “done”)

From repo root, with **API on :8000** and **Web on :3000**:

**Windows (PowerShell 7+):**

```powershell
pwsh -File scripts/repair-api-venv.ps1          # once if uv fails on .venv/lib64
pwsh -File scripts/dev-up.ps1 -ForcePorts       # stop WSL/port conflicts, start API + web
pwsh -File scripts/run-deliverable-gate.ps1              # local API gate
pwsh -File scripts/run-deliverable-gate.ps1 -Full        # local API + UI
pwsh -File scripts/run-deliverable-gate.ps1 -Staging     # local API + staging Preview API
pwsh -File scripts/run-deliverable-gate.ps1 -Full -Staging # full hello-world control (local + cloud)
```

**Unix / Git Bash / Cloud Agent:**

```bash
bash scripts/dev-up.sh
bash scripts/run-deliverable-gate.sh
bash scripts/run-deliverable-gate.sh --full
bash scripts/run-deliverable-gate.sh --staging
bash scripts/run-deliverable-gate.sh --staging --full
```

**Cross-platform (from `scripts/` after `npm install`):**

```bash
npm run gate:deliverable
npm run gate:deliverable:full
npm run gate:deliverable:staging
npm run gate:deliverable:staging:full
```

Against deployed test (not local):

```bash
STARDESK_WEB_URL=https://YOUR-WEB-TEST.vercel.app \
STARDESK_API_URL=https://YOUR-API-TEST.vercel.app \
TEST_USER_PASSWORD='…' \
bash scripts/run-deliverable-gate.sh --full
```

## Prerequisites

1. **Neon `test` branch:** `DATABASE_URL` in VM secrets → `bash scripts/sync-neon-env.sh` → `bash scripts/setup-dev-environment.sh` (Windows: `pwsh -File scripts/setup-dev-environment.ps1`)
2. Dev servers: `bash scripts/dev-up.sh` (Windows: `pwsh -File scripts/dev-up.ps1`)
3. `STARDESK_ENV` is `test` or `development` — **not** `production` (never Neon **main** for local gate)

## What to attach in PR / handoff

- [ ] Output of `run-deliverable-gate.sh` (pass)
- [ ] For UI changes: screenshot or video from `--full` (`artifacts/hello-world-gate/`)
- [ ] Confirm `stardesk_env` in `/health` matches intended target (development / test, not production unless explicitly deploying prod)

## Who must run it

| Actor | When |
|-------|------|
| **Cursor / Cloud Agent** | Before final summary and PR — see `AGENTS.md`, `CLAUDE.md` |
| **Human developer** | Before push / request review |
| **Work Board Agent Review** | In addition to task-specific Playwright URL (`docs/review-playwright-agent.md`) |

Task-specific review URLs remain required for feature work; **hello-world** is the shared baseline for all deliverables.

## CI (API gate on pull requests)

Workflow: `.github/workflows/deliverable-gate.yml`

- Runs on **pull requests** to `main` when repo secret **`DATABASE_URL`** is set (Neon **`test`** branch, `postgresql+asyncpg://…`).
- Boots API, runs `hello-world-gate-api.sh` (login + tickets + non-prod `/health`).
- **UI gate (`--full`)** is still required locally/Cloud Agent for web changes — CI does not run Playwright yet.

Agents and humans must still run `bash scripts/run-deliverable-gate.sh` locally before handoff; CI is an extra check, not a substitute.

## Staging (Vercel Preview after merge)

After a PR merges to **`staging`**, include **staging** in the hello-world control (same login/tickets checks — not production):

```powershell
pwsh -File scripts/run-deliverable-gate.ps1 -Staging
pwsh -File scripts/run-deliverable-gate.ps1 -Full -Staging   # + Playwright on staging web
```

```bash
bash scripts/run-deliverable-gate.sh --staging
bash scripts/run-deliverable-gate.sh --staging --full
```

Alias (staging API only): `pwsh -File scripts/verify-staging-hello-world.ps1`

Default Preview URLs (`STARDESK_STAGING_API_URL` / `STARDESK_STAGING_WEB_URL` to override):

- API: `https://api-git-staging-kjaerby-1628s-projects.vercel.app`
- Web: `https://web-git-staging-kjaerby-1628s-projects.vercel.app`

Requires **`DATABASE_URL`** (Neon **`test`**) on Vercel **api** → **Preview** — see **[staging-vercel-preview-env.md](./staging-vercel-preview-env.md)**. Protected deployments: `vercel link` or `VERCEL_PROTECTION_BYPASS` (Windows gate uses `vercel curl` fallback when possible).

## Production (after `staging` → `main` release)

The standard deliverable gate **rejects** `stardesk_env=production` on purpose. After Jan merges production, run the dedicated prod smoke:

```bash
cd scripts
TEST_USER_PASSWORD='Stardesk2026!' npm run gate:hello-world:prod
```

Checks: API `/health` + login + tickets (`sf01@example.dk`), web PRODUKTION banner, BFF login (`sf02@example.dk` by default), **Alle sager** on `/tickets` or `/service-desk`. Override URLs with `STARDESK_WEB_URL` / `STARDESK_API_URL`. Latest run summary: [reports/prod-hello-world-gate-latest.md](../reports/prod-hello-world-gate-latest.md).

## Related docs

- [AGENTS.md](../AGENTS.md) — Cloud VM setup
- [docs/environments.md](./environments.md) — development vs production vs test
- [docs/staging-vercel-preview-env.md](./staging-vercel-preview-env.md) — Vercel Preview env for `staging` + cloud hello-world
- [docs/review-playwright-agent.md](./review-playwright-agent.md) — per-task Work Board verification
