# Kodepraksis Agent

One-item-at-a-time remediation for [STARDESK-kodepraksis-50.md](../../workboard/constitution/STARDESK-kodepraksis-50.md) with an explicit **fallback ladder** per point.

## Commands (from `scripts/`)

```bash
npm run kodepraksis:init          # create/refresh queue JSON
npm run kodepraksis:export-plan   # regenerate plan markdown table
npm run kodepraksis:tick          # next item → reports/kodepraksis-agent-latest.md
npm run kodepraksis:status        # queue counts
npm run kodepraksis:result -- --n 39 --status done --notes "..." --pr https://...
```

## Fallback (every tick)

1. **Primary** — full scope from plan
2. **Partial** — reduced scope (document in `--notes`)
3. **Defer** — `--status deferred`, continue queue
4. **Skip** — `--status wontfix` with rationale

## Outputs

- `reports/kodepraksis-agent-queue.json` — machine state (committed)
- `reports/kodepraksis-agent-latest.md` — human/agent brief for current tick
- `workboard/constitution/STARDESK-kodepraksis-50-plan.md` — full 50-row table

## Agent loop

Prompt: `.cursor/prompts/kodepraksis-remediation-loop.md`  
Skill: `.cursor/skills/stardesk-kodepraksis-agent/SKILL.md`

**Not** the Sonar auto-merge loop — use normal PR-only flow to `staging`.
