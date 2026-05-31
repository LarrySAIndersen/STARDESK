# Sonar remediation loop — one tick

**Branch:** `cursor/sonar-remediation-loop` (create from latest `origin/staging` if missing).

**Never commit:** `SONAR_TOKEN`, `.env` secrets, or credentials.

---

## SCOPE (hard boundary)

Autonomous override (no manual control, auto merge/commit/push/deploy) applies **ONLY** to this Sonar remediation loop. **USER ABSENT:** never ask Jan; on CI failure fix and retry (e.g. ruff/Sonar) until green or log blocker in activityLog. Do not extend this override to other work.

| Context | Rules |
|---------|-------|
| **Sonar loop ONLY** | Autonomous: skip Human Review and Work Board gates. Auto-commit/push on `cursor/sonar-remediation-loop`. Auto-merge PR to `staging` and Flow-2 `staging`→`main` when CI is green. |
| **Everything else** | MUST follow `docs/pr-only-period.md`: feature branch → PR → `staging` (never direct push to `main` or `staging`). Flow 2 production: Jan merges `staging`→`main`. Deliverable gate required before handoff. Work Board / Human Review pipeline when active. No autonomous prod merge. |

Fixes must come from the Sonar Agent canvas queue (security vulnerabilities and code smells). Do not use this loop for unrelated features, general refactors, or non-Sonar PRs.

---

## 1. Scan

```bash
cd scripts && npm run sonar:pipeline
```

- Updates `reports/sonar-agent-latest.json`, security report, and canvas `stardesk-sonar-agent.canvas.data.json` (path via `SONAR_CANVAS_DATA_PATH` or default under Cursor canvases).
- Append activityLog: scan time + open security/vulnerability counts.

## 2. Select batch (max 5)

From canvas queue + latest JSON, pick up to **5** issues with `fixStatus: open` (or OPEN in Sonar), priority:

**BLOCKER → CRITICAL → MAJOR → MINOR** (include code smells / bugs when user scope is ALL Sonar issues; default tick focuses on **security vulnerabilities** until OPEN security count is 0).

Skip `false_positive` / `wontfix` unless Sonar still OPEN after suppression in code.

Reference: `.cursor/skills/stardesk-sonar-agent/SKILL.md`

## 3. Fix

- Minimal scoped code changes; English comments only when needed.
- Patterns: `scripts/lib/script-security.mjs`, `prototype_credentials.py`, NOSONAR for documented prototype demo only, path validation, no logging user-controlled argv/paths/URLs/bodies.
- Targeted tests: `cd apps/api && uv run pytest -q` (add paths if API touched).

## 4. Verify

```bash
bash scripts/run-deliverable-gate.sh
```

If any file under `apps/web/` changed:

```bash
bash scripts/run-deliverable-gate.sh --full
```

Re-run `npm run sonar:pipeline` when feasible (token present) to confirm count drop.

## 5. Git + PR (staging + prod)

```bash
git checkout cursor/sonar-remediation-loop   # or create from origin/staging
git add -A   # never stage .env, SONAR_TOKEN, apps/api/artifacts/
git commit -m "fix(sonar): <short English summary of batch>"
git push -u origin cursor/sonar-remediation-loop
```

**Staging PR:** If no open PR from this branch → `gh pr create --base staging --head cursor/sonar-remediation-loop --title "fix(sonar): loop batch …" --body "…"`. When CI green → `gh pr merge --auto --squash` (or merge when checks pass).

**Production (Flow 2):** If `staging` is ahead of `main`, ensure open PR `staging` → `main` exists; when green, `gh pr merge` (user authorized auto-prod for this loop). See `docs/pr-only-period.md` Flow 2.

If **api-security** CI fails on docs-only changes, fix the blocker or document in activityLog and proceed next tick.

## 6. Canvas

Update `stardesk-sonar-agent-v1`:

- `queue[]`: `fixStatus: fixed`, `fixNotes`, `fixedAt` for resolved keys
- `summary`: recompute open/fixed
- `activityLog`: append `{ at, actor: "agent", action: "Loop tick", detail: "…" }` (trim to 80)
- `phase`: `verify` → `idle`; `lastScanAt`, `lastReportAt`

Run `npm run sonar:sync-canvas` after rescan if needed.

## 7. Stop conditions

Stop the loop (do not schedule further ticks) when:

1. Sonar OPEN **security vulnerabilities** = 0 (per latest pipeline summary), **or**
2. **3 consecutive ticks** with no progress (same open count after fix attempt).

Report remaining counts and PR URLs in the tick summary.

## Tick report (required)

Danish one-liner in canvas activityLog; English in commit/PR:

```
Tick: <ISO> — fixed N issues — gate PASSED/FAILED — open security M — PR staging # — PR prod #
```
