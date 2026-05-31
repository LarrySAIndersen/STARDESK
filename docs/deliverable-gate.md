# Deliverable gate — hello-world (obligatorisk for alle leverancer)

Every **deliverable** (PR, Cloud Agent task, Work Board handoff) must pass the **hello-world gate** before it is considered done. This proves the STARDESK core path works end-to-end: **auth → ticket list** (same flow as production, on a non-production target).

## What the gate checks

| Step | API (fast) | UI (Playwright, `--full`) |
|------|------------|---------------------------|
| Environment is not confused with prod | `/health` → `stardesk_env` ≠ `production` when testing **local/test** | Amber/sky banner visible (not production) |
| Login works | `POST /api/v1/auth/login` (Anna `sf01@example.dk`) | Demo picker or email/password login |
| Tickets exist | `GET /api/v1/tickets` with JWT → ≥1 item | `/tickets` shows demo rows (e.g. `DEMO-`, `SF Operations`) |

**Default demo user:** `sf01@example.dk` / `Stardesk2026!` (see `apps/web/src/lib/demo-users.ts`).

## Commands (run before you say “done”)

From repo root, with **API on :8000** and **Web on :3000** (see `bash scripts/dev-up.sh`):

```bash
# Minimum (API only, ~2s) — required for every deliverable
bash scripts/run-deliverable-gate.sh

# Full proof (API + browser + screenshots) — required for UI/auth/routing changes
bash scripts/run-deliverable-gate.sh --full

# Against deployed test (not local)
STARDESK_WEB_URL=https://YOUR-WEB-TEST.vercel.app \
STARDESK_API_URL=https://YOUR-API-TEST.vercel.app \
TEST_USER_PASSWORD='…' \
bash scripts/run-deliverable-gate.sh --full
```

From `scripts/` (after `npm install`):

```bash
npm run gate:deliverable
npm run gate:deliverable:full
```

## Prerequisites

1. **Neon `test` branch:** `DATABASE_URL` in VM secrets → `bash scripts/sync-neon-env.sh` → `bash scripts/setup-dev-environment.sh`
2. Dev servers: `bash scripts/dev-up.sh`
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

## Related docs

- [AGENTS.md](../AGENTS.md) — Cloud VM setup
- [docs/environments.md](./environments.md) — development vs production vs test
- [docs/review-playwright-agent.md](./review-playwright-agent.md) — per-task Work Board verification
