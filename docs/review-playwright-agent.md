# Review Playwright agent

Automated smoke verification when a Work Board task moves **In Progress → Agent Review** (`Review`) with `reviewVerificationScope: "stardesk"`.

The Work Board canvas **cannot** run Playwright. It sets `reviewPlaywrightEvidence.status` to `"pending"` and starts an **Agent Review** Cursor chat. A Cursor agent, local script, or **GitHub Actions** runs Playwright externally and imports results back into the Work Board (canvas JSON and/or Neon via API).

## Flow

1. Task reaches **Agent Review** with STARDESK verification URL.
2. Canvas sets `reviewPlaywrightEvidence` to `pending` and `agentReviewEvidence` to `pending` (method `hybrid` for stardesk, `canvas` for cursor scope).
3. Work Board auto-starts Agent Review chat (`newComposerChat`) with prompt referencing `STARDESK/.cursor/skills/stardesk-agent-review/SKILL.md`.
4. Review agent runs Playwright runner (login + navigate + smoke clicks + screenshots) when scope is stardesk.
5. Import manifest into Work Board JSON and/or push to Neon via API.
6. Agent updates `agentReviewEvidence` (passed/failed) and `humanReviewHandoff` before Human Review.

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

Scan all Agent Review tasks with pending evidence:

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

**On push to `main`:** scans API for Agent Review tasks with `reviewPlaywrightEvidence.status === "pending"` and runs the pipeline for each (when secrets are configured).

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

Agent Review writes `agentReviewEvidence` (status, method, summary, `humanReviewHandoff`, findings).

## Work Board UI

- Field: `reviewPlaywrightEvidence` — foldable **Playwright-evidence** panel
- Field: `agentReviewEvidence` — **Agent Review-verifikation** banner in Agent Review detail
- When Playwright `status === "pending"`: banner **Kør Playwright-agent** copies pipeline command / GitHub Action hint
- When Agent Review `status === "pending"` / `"running"`: warning before **Send til Human Review**
- When Agent Review `status === "failed"`: **Send til Human Review** blocked
- Auto-start: entering Agent Review opens Agent Review chat (like I gang → implement agent)

## Cursor agent vs auto-start

| Transition | Auto chat |
|------------|-----------|
| → **In Progress** | Implementerings-agent (`buildInProgressWorkPrompt`) |
| → **Agent Review** | Agent Review-agent (`buildAgentReviewPrompt`) + Playwright pending (stardesk) |

Moving a task calls `newComposerChat` from the Work Board canvas — opens a **new Cursor agent chat** in the IDE. Not silent/background.

If no chat appeared:

- Work Board canvas must be open in Cursor when you drag to the column
- Use **Start Agent Review-agent** in task detail to retry
- Subagent chats started elsewhere do not count as the Work Board auto-agent

See `stardesk-workboard.mdc` and `STARDESK/.cursor/skills/stardesk-agent-review/SKILL.md`.

## Agent Review AC-matrix (review agent)

Playwright is **one proof** for functional criteria. The **review agent** must still verify **all** accept criteria in the task spec and fill `agentReviewEvidence.acceptCriteria` before `passed`.

See `docs/agent-review-ac-matrix.md` and `docs/stardesk-agent-review-skill.md`.

## Related tasks

- **#100** — AC-matrix, LEVERANCE Jan-guide, AcceptCriteriaMatrixPanel
- **#74** — Playwright evidence (GitHub Action + canvas pending banner)
- **#85** — Agent Review auto-verification + skill + Human Review gates
