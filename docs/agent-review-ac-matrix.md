# Agent Review — AC-matrix og LEVERANCE/AGENT VIEW

Project model for Work Board **Agent Review** (task **#100**).

## Three layers

| Layer | Field | Audience | Content |
|-------|--------|----------|---------|
| Spec | `Acceptkriterier` in kodningsklar spec | Agents | Functional + technical requirements |
| Delivery | `reviewDeliverySummary` | Jan (Human Review) | What was built — **user-visible**, Danish |
| Verification | `agentReviewEvidence` + `agentReviewView` | Jan + audit | AC matrix, Playwright, handoff |

## Review agent core job

The **review agent** (Cursor, skill `stardesk-agent-review`) must verify **LEVERANCE** against **every** accept criterion — not only run Playwright.

| Criterion type | Examples | Typical proof |
|----------------|----------|----------------|
| **Functional** | Flows, gates, UI copy, disabled buttons | Playwright (`stardesk`), manual URL, canvas |
| **Technical** | Code, API, tests, persistence | Code review, pytest |

Playwright (`reviewVerificationScope: stardesk`) is **evidence for some functional** criteria. It does not replace the AC checklist.

## `acceptCriteria` on `agentReviewEvidence`

One object per line under **Acceptkriterier** in spec:

```json
{
  "id": "ac-1",
  "text": "I gang kan ikke springe til Human Review",
  "category": "technical",
  "status": "passed",
  "method": "kode",
  "note": "validateWorkboardStatusChange"
}
```

Overall `agentReviewEvidence.status: passed` only when **all** rows are `passed` or `skipped` (with note).

Work Board blocks **Human Review** if spec has accept criteria but matrix is incomplete when evidence is `passed`.

## Scope

| `reviewVerificationScope` | Playwright | Review focus |
|---------------------------|------------|--------------|
| `stardesk` | Yes (external pipeline / GHA) | Hybrid: Playwright + AC + code |
| `cursor` | No | Canvas/code + AC |
| `none` | No | Self-review vs spec |

## UI

- **LEVERANCE** — Jan-language delivery (hint in Review panel).
- **AGENT VIEW** — «Sådan verificeres» + «Verificeret» + AC matrix (Funktionelle / Tekniske).
- **AcceptCriteriaMatrixPanel** — counter e.g. `6/6 bestået` in Agent Review evidence box.

## Commands

```bash
# Playwright (stardesk tasks)
cd STARDESK/scripts
npm run review:playwright:pipeline -- --task <NUMBER>

# Sync tasks to Neon
node STARDESK/scripts/migrate-workboard-json-to-db.mjs
```

## Related

- `docs/stardesk-agent-review-skill.md` — agent skill (git copy)
- `docs/review-playwright-agent.md` — Playwright runner
- `docs/workboard-persistence.md` — Neon vs canvas JSON
- `workboard/stardesk-workboard.canvas.tsx` — canvas source mirror
