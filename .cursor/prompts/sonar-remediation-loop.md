# Sonar remediation loop — one tick

**Branch:** `cursor/sonar-remediation-loop` (create from latest `origin/staging` if missing).

**Never commit:** `SONAR_TOKEN`, `.env` secrets, or credentials.

**Staging batch:** one commit per tick; merge PR to `staging` only when branch has **10 commits**. **Never merge to `main`** — Jan handles prod.

---

## SCOPE (hard boundary)

Autonomous override applies **ONLY** to this Sonar remediation loop on **`staging`**. **USER ABSENT:** never ask Jan; on CI failure fix and retry until green or log blocker in activityLog.

| Context | Rules |
|---------|-------|
| **Sonar loop ONLY** | Auto-commit/push on `cursor/sonar-remediation-loop`. Draft PR to `staging`. Auto-merge to **staging only** when **≥ 10 commits** + CI green. |
| **Production** | **Never** auto-merge `staging` → `main`. Jan merges prod manually. |
| **Everything else** | Follow `docs/staging-batch-policy.md` and `docs/pr-only-period.md`. |

Fixes must come from the Sonar Agent canvas queue. No unrelated features.

---

## 1. Scan

```bash
cd scripts && npm run sonar:pipeline
```

- Updates reports and canvas `stardesk-sonar-agent.canvas.data.json`.
- Append activityLog: scan time + open counts.

## 2. Select batch (max 5 issues)

From canvas queue + latest JSON, pick up to **5** open issues, priority:

**BLOCKER → CRITICAL → MAJOR → MINOR**

Reference: `.cursor/skills/stardesk-sonar-agent/SKILL.md`

## 3. Fix

- Minimal scoped code changes.
- Targeted tests when API touched.

## 4. Verify

```bash
bash scripts/run-deliverable-gate.sh
```

Add `--full` if `apps/web/` changed.

## 5. Git + PR (staging batch only)

```bash
git checkout cursor/sonar-remediation-loop   # or create from origin/staging
git add -A   # never stage .env, SONAR_TOKEN, apps/api/artifacts/
git commit -m "fix(sonar): <short English summary>"
git push -u origin cursor/sonar-remediation-loop
```

**Commit count** (commits on this branch in the open PR):

```bash
gh pr view --json commits --jq '.commits | length'   # if PR exists
# or: git rev-list --count origin/staging..HEAD
```

**Staging PR:**

- If no open PR → create **draft** PR: `gh pr create --base staging --draft --title "fix(sonar): batch …"`
- If commit count **< 10**: leave PR **draft**; log `Batch N/10 commits — staging deploy deferred`
- If commit count **≥ 10**: run gate again if needed → `gh pr ready` → auto-merge when CI green
- After merge to staging: reset branch from `origin/staging` for next batch

**Production:** do **not** merge `staging` → `main`. Flow-2 PR may exist for Jan — never `gh pr merge` on it from this loop.

## 6. Canvas

Update queue, summary, activityLog, phase.

## 7. Stop conditions

Stop when OPEN security vulnerabilities = 0, or 3 consecutive ticks with no progress.

## Tick report (required)

```
Tick: <ISO> — fixed N issues — commits M/10 on branch — gate PASSED/FAILED — open security K — staging PR # (draft|ready)
```
