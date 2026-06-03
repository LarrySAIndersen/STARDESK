---
name: stardesk-kodepraksis-agent
description: Execute STARDESK kodepraksis-50 constitution items one at a time with fallback ladder, queue JSON, and PR to staging. Use when improving code quality per workboard/constitution/STARDESK-kodepraksis-50.md or kodepraksis tick/queue.
---

# STARDESK Kodepraksis Agent

## When to use

- User asks for kodepraksis-50, code quality plan, or "én ad gangen" constitution work
- `npm run kodepraksis:tick` was run and `reports/kodepraksis-agent-latest.md` exists

## One tick workflow

1. `cd scripts && npm run kodepraksis:tick` — read latest.md
2. Implement **only** `queue.currentN` item; on failure use fallback ladder (partial → defer → wontfix)
3. `bash scripts/run-deliverable-gate.sh` (+ `--full` for web)
4. Commit on shared branch (e.g. `cursor/kodepraksis-batch`); draft PR to `staging`; merge when **10 commits** or label `batch-ready` — see `docs/staging-batch-policy.md`
5. `npm run kodepraksis:result -- --n <N> --status done|partial|deferred|wontfix [--fallback partial] [--pr URL]`

## Sources

- Plan: `scripts/kodepraksis-agent/kodepraksis-plan.mjs`
- Table: `workboard/constitution/STARDESK-kodepraksis-50-plan.md`
- Queue: `reports/kodepraksis-agent-queue.json`
- Prompt: `.cursor/prompts/kodepraksis-remediation-loop.md`

## Fallback (mandatory)

Never block the whole queue on one item. Document `lastFallback` and `notes` in queue when using partial/defer/wontfix.
