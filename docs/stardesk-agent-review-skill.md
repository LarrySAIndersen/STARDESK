# Skill: stardesk-agent-review (git copy)

Live path (Cursor, gitignored): `STARDESK/.cursor/skills/stardesk-agent-review/SKILL.md`

This file is a **tracked mirror** for commits. Keep in sync when changing the skill.

---
name: stardesk-agent-review
description: Self-review before handoff (Playwright/code). Work Board integration is retired — use for PR verification only when user asks, not for canvas kanban tasks.
---

# STARdesk Agent Review

> **Work Board pensioneret:** Ignorér kanban/canvas task-flow (`stardesk-workboard.canvas.data.json`, Agent Review kolonner, `agentReviewEvidence`). Brug denne skill kun til **PR/leverance-verifikation** når brugeren beder om det — deliverable gate, Playwright, kodegennemgang.

## When to run (without Work Board)

## Task context fields

| Field | Use |
|-------|-----|
| `number`, `title`, `description` | Scope and accept criteria (`--- Kodningsklar spec ---`, **Acceptkriterier**) |
| `agentPlan` | What the implementer planned/did |
| `reviewDeliveryHeading`, `reviewDeliverySummary` | Declared delivery |
| `reviewVerificationScope` | `stardesk` \| `cursor` \| `none` |
| `reviewVerificationUrl`, `reviewVerificationLabel` | Deployed STARDESK route (stardesk scope) |
| `reviewPlaywrightEvidence` | E2E smoke result (screenshots, log, status) |
| `agentReviewEvidence` | **Your output** — pass/fail, findings, handoff |
| `reviewRejectAttachments` | Prior Human Review rejection (if rerun) |

## Core job (all scopes)

The review agent's **primary** task is to verify **LEVERANCE** against **every accept criterion** in the task spec (`Acceptkriterier` section):

| Type | Examples | Typical proof |
|------|----------|----------------|
| **Functional** | User flows, gates, Danish UI, disabled buttons | Playwright (stardesk), manual URL check, canvas UX |
| **Technical** | Code paths, API, tests, persistence, types | Code inspection, pytest, grep |

**Playwright** (scope `stardesk` only) supports **some** functional criteria — it does **not** replace the AC checklist.

Fill `agentReviewEvidence.acceptCriteria` on the task — one entry per spec line:

```json
{
  "id": "ac-1",
  "text": "I gang kan ikke springe til Human Review",
  "category": "technical",
  "status": "passed",
  "method": "kode",
  "note": "validateWorkboardStatusChange linje 4121"
}
```

Set overall `status: "passed"` only when **all** criteria are `passed` or `skipped` (with note). Failed AC → `status: "failed"` and list in `findings`.

**LEVERANCE** (for Jan): what was built in user-visible terms — not file lists. **AGENT VIEW** syncs the AC matrix + Playwright line + handoff.

## Review methods

Choose by scope and tags — or run **hybrid** with parallel subagents.

### Playwright (scope `stardesk`)

External runner — canvas cannot execute Playwright.

```bash
cd STARDESK/scripts
npm run review:playwright:pipeline -- --task <NUMBER>

# Or GitHub Actions: Review Playwright Evidence → Run workflow → task_number=<NUMBER>
# Secrets: TEST_USER_PASSWORD, STARDESK_API_URL, STARDESK_API_TOKEN
```

After run, re-read `reviewPlaywrightEvidence` on the task. Treat `failed` Playwright as agent review **failed** unless delivery clearly wrong URL.

See `STARDESK/docs/review-playwright-agent.md`.

### Code review (scope `cursor`, STARDESK code changes)

- Inspect files named in `reviewDeliverySummary` and git diff.
- Verify accept criteria from spec without requiring deployed app.
- Check types, auth, Danish UI copy where relevant.

### Canvas review (Work Board / canvas-only tasks)

- Open `canvases/stardesk-workboard.canvas.tsx` and related canvas data.
- Verify UX, persistence keys, activity log, fieldHistory behaviour described in delivery.

### Hybrid

Combine Playwright + code + UX sub-reviews. Record `subagentMethods` on `agentReviewEvidence`.

## Parallel subagents

Use the **Task** tool to run focused reviewers in parallel:

| Subagent | Prompt focus | When |
|----------|--------------|------|
| `explore` | Code diff vs accept criteria | Always for repo changes |
| `generalPurpose` + browser MCP | Manual E2E on `reviewVerificationUrl` | stardesk scope, Playwright unavailable |
| Portal skill | Read `stardesk-portal-usability` | portal/borger tags |

Merge subagent findings into one `agentReviewEvidence` update.

## Verification steps

1. Read this skill and the task's spec + delivery + agentPlan.
2. Run method(s) per scope (Playwright pipeline for stardesk if evidence pending).
3. Check **every** accept criterion — note gaps in `findings`.
4. Update `agentReviewEvidence` on the task in `stardesk-workboard.canvas.data.json`.
5. Append `activityLog` entry: `"Agent Review verifikation"` with pass/fail detail.
6. If **passed**: ensure `humanReviewHandoff` is ready; task may move to Human Review (agent or user via Work Board).
7. If **failed**: do **not** send to Human Review — move task to **In Progress** with clear findings in description or `agentRerunReason` if rework needed.

## Output format (`agentReviewEvidence`)

```json
{
  "at": 1780000000000,
  "actor": "agent",
  "status": "passed",
  "method": "hybrid",
  "subagentMethods": ["playwright", "code"],
  "summary": "6/6 acceptkriterier bestået; Playwright passed mod /aktiver.",
  "acceptCriteria": [
    {
      "id": "ac-1",
      "text": "Resizable kolonner på Aktiver",
      "category": "functional",
      "status": "passed",
      "method": "playwright"
    },
    {
      "id": "ac-2",
      "text": "pytest tests grønne",
      "category": "technical",
      "status": "passed",
      "method": "kode"
    }
  ],
  "humanReviewHandoff": "Jan: Aktiver har resizable kolonner — Playwright smoke passed. Spot-tjek at drag handles føles naturlige på smal skærm.",
  "verifiedAt": 1780000001000,
  "findings": []
}
```

Status values: `pending` | `running` | `passed` | `failed` | `skipped` (only if scope none and manual skip documented).

Method values: `playwright` | `agent` | `code` | `canvas` | `hybrid` | `manual`.

On **failed**:

```json
{
  "status": "failed",
  "method": "playwright",
  "summary": "Playwright fejlede: login timeout.",
  "findings": ["Smoke mod reviewVerificationUrl fejlede", "Screenshot viser 404"],
  "humanReviewHandoff": null
}
```

Sync to Neon when applicable: `node STARDESK/scripts/migrate-workboard-json-to-db.mjs`.

## Human Review handoff (`humanReviewHandoff`)

Danish, 3–6 sentences for Jan:

- What was delivered (concrete)
- What was verified (Playwright / code / canvas)
- What to spot-check manually in Human Review
- Link or scope note (`reviewVerificationUrl` or «kun Cursor»)

Do not use «Planlagt leverance» — describe verified reality.

## Work Board gates

- **Send til Human Review** is **blocked** when `agentReviewEvidence.status === "failed"`.
- **Pending/running** shows a warning banner — complete verification first.
- **Passed/skipped** allows handoff.

## Related

- Playwright infra: task **#74**, `STARDESK/scripts/run-review-playwright.mjs`
- Agent Review automation: task **#85**
- Review prep (before Agent Review): `stardesk-workboard-review-prep` skill
- Rules: `.cursor/rules/stardesk-workboard.mdc`
