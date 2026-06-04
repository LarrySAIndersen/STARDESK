---
name: stardesk-sonar-agent
description: >-
  Sonar Security Agent for STARDESK — scan SonarCloud, triage vulnerabilities,
  fix in batches, sync canvas queue, write structured report. Use when the
  Sonar Agent canvas triggers a run, or when remediating Sonar security findings.
---

# STARDESK Sonar Security Agent

Fixed workflow for **scan → triage → fix → verify → report**. Canvas UI:
`canvases/stardesk-sonar-agent.canvas.tsx`.

## Before you start

1. Read `ARCHITECTURE.md` if touching API/web security paths.
2. Open the Sonar Agent canvas beside chat — state lives in `stardesk-sonar-agent.canvas.data.json`.
3. Ensure `SONAR_TOKEN` + `SONAR_PROJECT_KEY` are set (never commit token).

## Pipeline commands

From `STARDESK/scripts/`:

```bash
npm run sonar:pipeline          # scan + sync canvas + security report
npm run sonar:agent             # scan only → reports/sonar-agent-latest.json
npm run sonar:sync-canvas       # merge scan into canvas queue
```

Reports:

- `reports/sonar-agent-latest.json` — machine input (all issue types)
- `reports/sonar-security-latest.md` — human security summary
- Canvas queue — fix tracking (`fixStatus` per issue)

## Phases (always in order)

### 1. Scan

- Run `npm run sonar:pipeline` (or `sonar:agent` + `sonar:sync-canvas`).
- Set canvas `phase` → `scan` then `triage` after sync.
- Append activityLog: scan timestamp + counts.

### 2. Triage

- Work **security only** (`type: VULNERABILITY`, status OPEN/CONFIRMED).
- Priority: **BLOCKER → CRITICAL → MAJOR → MINOR**.
- Classify each queue item:
  - `open` — must fix
  - `false_positive` — demo/test with Sonar suppression or refactor
  - `wontfix` — documented exception (rare)
- Update canvas queue `fixStatus` / `fixNotes`.

**Known triage patterns (STARDESK prototype):**

| Rule | Typical action |
|------|----------------|
| `secrets:S8215` bcrypt in seed/bootstrap | Centralize in `prototype_credentials.py`; migration reads constant; no raw hash in alembic |
| `python:S2068` / `typescript:S2068` demo passwords | Keep in `demo.py` / `demo-users.ts` with NOSONAR + comment "prototype demo only" OR env-driven |
| `python:S5443` `/tmp` in config/tests | Use `tempfile` + restricted dir; document test-only |
| `pythonsecurity:S2083` path traversal | Validate/sanitize paths; reject `..`; use `Path.resolve` + prefix check |
| `kubernetes:S6865` | `automountServiceAccountToken: false` where no K8s API needed |

### 3. Fix (batched)

- **One commit per agent run/tick** on the loop branch; accumulate until **10 commits** before staging merge.
- **Batch size:** max 5 BLOCKER/CRITICAL issues per tick.
- Fix code in repo; minimal scope; match existing conventions.
- After each tick:
  - Run targeted tests (`cd apps/api && uv run pytest -q <relevant>`)
  - Update canvas queue: `fixStatus: fixed`, `fixedAt`, `fixNotes`
  - Push commit; keep PR **draft** until 10 commits (see `docs/staging-batch-policy.md`)
- Set canvas `phase` → `fix`.

### 4. Verify

- `bash scripts/run-deliverable-gate.sh` (UI changes: `--full`)
- Re-run `npm run sonar:pipeline` to confirm issue count dropped.
- Set canvas `phase` → `verify`.

### 5. Report

Write Danish summary in activityLog (Sonar canvas) or in PR description:

```
Scan: <ISO tid> — N sikkerhedsissues (B blocker, C critical)
Fix: <filer> — <hvad der ændredes>
Verify: gate passed / sonar recount M remaining
Staging batch: <N>/10 commits — draft|ready
Næste batch: <top 3 åbne blocker>
```

Set canvas `phase` → `report` then `idle`.
Update `lastReportPath`: `reports/sonar-security-latest.md`.

## Canvas update contract

When finishing a run, merge into `stardesk-sonar-agent-v1` in canvas data:

- `summary` — recompute open/fixed counts from queue
- `queue[]` — preserve `key`; update `fixStatus`, `fixNotes`, `fixedAt`
- `activityLog[]` — append `{ at, actor: "agent", action, detail }` (max 80 entries)
- `lastScanAt`, `phase`, `lastReportAt`

Run `npm run sonar:sync-canvas` after Sonar rescan to merge new issues without losing fix status.

## Do not

- Commit `SONAR_TOKEN` or real production secrets
- Fix >10 Sonar issues in one commit without re-scan between ticks
- Merge to `staging` before 10 commits (unless label `batch-ready` / `hotfix`)
- Auto-merge or merge `staging` → `main` (Jan only)
- Suppress BLOCKER without code fix or documented prototype exception

## References

- `scripts/sonar-agent/README.md`
- `docs/deliverable-gate.md`
- Sonar project: `LarrySAIndersen_STARDESK`
