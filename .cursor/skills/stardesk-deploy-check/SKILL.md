---
name: stardesk-deploy-check
description: >-
  STARDESK Deploy Check Agent — poll Vercel deployments after merge, run hello-world
  gates on staging/production, classify failures, record fix outcomes to improve scans.
  Use when deploy check fails, after staging/main merge, or when fixing deploy errors.
---

# STARDESK Deploy Check Agent

Automatic post-deploy verification with a **feedback loop** — each fix (success or failure) improves the knowledge base for the next scan.

## When this runs

| Trigger | Target | Checks |
|---------|--------|--------|
| Push/merge to `staging` | Preview URLs | Vercel poll + API gate + UI gate (`--full`) |
| Push/merge to `main` | Production URLs | Vercel poll + API gate |
| `workflow_dispatch` | Manual | Configurable |
| VM watchdog | Staging if stale | `npm run deploy-check:pipeline` |
| After your fix | Re-run locally | `npm run deploy-check:pipeline -- staging` |

GitHub Action: `.github/workflows/deploy-check.yml`

## Pipeline commands

From `scripts/`:

```bash
npm run deploy-check:pipeline              # staging (default)
npm run deploy-check:pipeline -- production
npm run deploy-check:pipeline -- staging --full   # explicit UI gate
npm run deploy-check:poll -- staging       # Vercel READY poll only
npm run deploy-check:prompt                # emit agent handoff markdown
```

Reports:

- `reports/deploy-check-latest.json` — machine input
- `reports/deploy-check-latest.md` — human summary
- `reports/deploy-check-agent-prompt.md` — failure handoff (Cursor agent)
- `reports/deploy-check-knowledge.json` — accumulated patterns + fix history

Seed patterns: `scripts/deploy-check/knowledge-seed.json`

## Workflow (fix loop)

### 1. Read failure

```bash
cat reports/deploy-check-latest.md
cat reports/deploy-check-agent-prompt.md
```

Each failure includes **classified patterns** (id, diagnosis, suggested fix, prior attempts).

### 2. Diagnose & fix

Common staging failures — see `docs/staging-vercel-preview-env.md`:

| Pattern id | Typical cause |
|------------|----------------|
| `vercel-protection-401` | Preview Deployment Protection |
| `database-not-configured` | Missing `DATABASE_URL` on api Preview |
| `login-failed` | JWT / bootstrap password / seed |
| `no-tickets` | Neon test not bootstrapped |
| `vercel-build-error` | Vercel build failed (CI may still be green) |

Branch: `cursor/deploy-fix-<slug>-a7ba` → **draft PR to `staging`** (PR-only policy).

### 3. Verify after merge

Wait for Vercel deploy (or poll):

```bash
npm run deploy-check:poll -- staging
npm run deploy-check:pipeline -- staging --full
```

### 4. Write back to agent (mandatory)

**On success:**

```bash
npm run deploy-check:result -- \
  --pattern database-not-configured \
  --status fixed \
  --notes "Added DATABASE_URL to api Preview env" \
  --pr "https://github.com/.../pull/NNN"
```

**On failure:**

```bash
npm run deploy-check:result -- \
  --pattern database-not-configured \
  --status failed \
  --notes "Still failing after redeploy — suspect Neon connection limit"
```

**New failure signature** (improves future scans):

```bash
npm run deploy-check:result -- \
  --pattern login-failed \
  --status failed \
  --notes "JWT_SECRET mismatch" \
  --add-match "invalid token signature"
```

This increments `checkSuiteVersion` and merges match strings into the knowledge base.

### 5. Commit knowledge updates

If `reports/deploy-check-knowledge.json` changed, include it in your fix PR so the next merge inherits improved scanning.

## Environment

| Variable | Where | Purpose |
|----------|-------|---------|
| `VERCEL_TOKEN` | GitHub secret / VM | Poll deployment status |
| `VERCEL_PROTECTION_BYPASS` | GitHub secret / VM | Preview protection header |
| `TEST_USER_PASSWORD` | GitHub secret / VM | Demo login (`Stardesk2026!`) |
| `STARDESK_STAGING_API_URL` | Optional override | Preview API URL |

## Rules

- **Never** auto-fix production — escalate to Jan
- **Never** push to `main`/`staging` directly — PR only
- Record **both** success and failure via `deploy-check:result`
- Do not mark work done without deliverable gate: `bash scripts/run-deliverable-gate.sh`

## Related

- `docs/deploy-check-agent.md`
- `docs/staging-vercel-preview-env.md`
- `docs/deliverable-gate.md`
- `.cursor/skills/stardesk-watchdog/SKILL.md` — includes deploy-check staleness check
