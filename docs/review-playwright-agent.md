# Review Playwright agent

Automated smoke verification when a Work Board task moves **In Progress → Review** with `reviewVerificationScope: "stardesk"`.

The Work Board canvas **cannot** run Playwright. It only sets `reviewPlaywrightEvidence.status` to `"pending"` and copies `reviewVerificationUrl`. A Cursor agent, local script, or **GitHub Actions** runs Playwright externally and imports results back into the Work Board (canvas JSON and/or Neon via API).

## Flow

1. Task reaches **Review** with STARDESK verification URL.
2. Canvas sets `reviewPlaywrightEvidence` to `pending` (see foldable panel in task detail).
3. Run Playwright runner (login + navigate + smoke clicks + screenshots).
4. Import manifest into Work Board JSON and/or push to Neon via API.

## Commands

From `STARDESK/scripts` (after `npm install`):

```bash
# 1) Install Playwright browsers once
npx playwright install chromium

# 2) Set credentials (never commit)
export TEST_USER_EMAIL=sf01@example.dk
export TEST_USER_PASSWORD='your-demo-password'

# 3) Full pipeline (run + import) for task #54
npm run review:playwright:pipeline -- --task 54

# Or step by step:
node run-review-playwright.mjs --task 54
node import-playwright-evidence-to-workboard.mjs --task 54
node ../scripts/migrate-workboard-json-to-db.mjs
```

Scan all Review tasks with pending evidence:

```bash
npm run review:playwright:trigger
# CI / headless (Neon as source of truth):
node trigger-review-playwright-on-board.mjs --export-from-api --push-to-api
```

Optional API export instead of local JSON:

```bash
export STARDESK_API_URL=https://api-gamma-amber.vercel.app
export STARDESK_API_TOKEN=<staff-jwt>
node run-review-playwright-pipeline.mjs --task 54 --export-from-api --push-to-api
```

Override URL or user:

```bash
node run-review-playwright.mjs --url https://web-seven-neon-6bvmcoel7n.vercel.app/aktiver --task-id t-54
node run-review-playwright.mjs --task 54 --email sf02@example.dk
```

## GitHub Actions (recommended for Jan — no local run)

Workflow: `.github/workflows/review-playwright.yml`

**Manual run (one task):**

1. GitHub → Actions → **Review Playwright Evidence** → **Run workflow**
2. Enter Work Board task number (e.g. `54`)
3. Requires repo secrets: `TEST_USER_PASSWORD`, `STARDESK_API_URL`, `STARDESK_API_TOKEN` (optional `TEST_USER_EMAIL`)

The workflow runs `run-review-playwright-pipeline.mjs` with `--export-from-api --push-to-api`, uploads screenshots as artifacts, and updates Neon. Re-open Work Board canvas to see imported evidence (or sync export → canvas JSON).

**On push to `main`:** scans API for Review tasks with `reviewPlaywrightEvidence.status === "pending"` and runs the pipeline for each (when secrets are configured).

## Environment

| Variable | Purpose |
|----------|---------|
| `TEST_USER_EMAIL` | Prototype staff login (default `sf01@example.dk`) |
| `TEST_USER_PASSWORD` | Required — same as demo users in `apps/web/src/lib/demo-users.ts` |
| `STARDESK_WEB_URL` | Web app base (default deployed Vercel URL) |
| `WORKBOARD_DATA_PATH` | Override path to `stardesk-workboard.canvas.data.json` |
| `REVIEW_EVIDENCE_DIR` | Override `reports/review-evidence/` root |
| `STARDESK_API_URL` / `STARDESK_API_TOKEN` | For `--export-from-api` / `--push-to-api` |

## Output

- `reports/review-evidence/{taskId}/manifest.json`
- `reports/review-evidence/{taskId}/*.png`

Import writes `reviewPlaywrightEvidence` on the task (base64 PNGs, step log, `passed` / `failed`).

## Work Board UI

- Field: `reviewPlaywrightEvidence`
- Panel: **Playwright-evidence (N billeder)** — collapsed by default under Review in task detail
- When `status === "pending"`: banner **Kør Playwright-agent** copies pipeline command / GitHub Action hint
- State key: `stardesk-playwright-evidence-expanded-v1`

## Cursor agent vs auto-start

Moving a task to **In Progress** calls `newComposerChat` from the Work Board canvas — this opens a **new Cursor agent chat** in the IDE. It does not run silently in the background. If no chat appeared:

- Work Board canvas must be open in Cursor when you drag to I gang
- Use **Start Cursor-agent** in task detail to retry (copies prompt + opens chat)
- Subagent chats started elsewhere do not count as the Work Board auto-agent

See `stardesk-workboard.mdc` rule 8 and the In Progress panel in task detail.

## Related task

**#74** — Playwright auto-trigger (GitHub Action + canvas pending banner + In Progress agent hint).
