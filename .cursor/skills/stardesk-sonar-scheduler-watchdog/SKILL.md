---
name: stardesk-sonar-scheduler-watchdog
description: >-
  Keeps the Sonar loop scheduler (30 min tick) running on the VM. Monitors
  reports/sonar-loop-scheduler.pid, restarts run-sonar-loop-scheduler.ps1 on
  failure, syncs canvas schedulerStatus. Use when canvas shows Scheduler
  stoppet, sonar loop hænger, or scheduler PID is missing.
---

# Sonar scheduler watchdog agent

Lightweight background agent — **only** keeps `run-sonar-loop-scheduler.ps1` alive. For full release/Sonar loop repairs (PR merge, stale scan), use `stardesk-watchdog` skill.

## Start (VM / Jan's machine)

From `STARDESK/scripts/`:

```powershell
npm run sonar:loop:start
```

This starts:

1. **Scheduler** — tick every 30 min (`reports/sonar-loop-scheduler.pid`)
2. **Scheduler watchdog** — check every 5 min, auto-restart scheduler (`reports/sonar-scheduler-watchdog.pid`)

Individual commands:

```powershell
npm run sonar:loop-scheduler:start
npm run sonar:scheduler-watchdog:start
```

## Stop

```powershell
npm run sonar:scheduler-watchdog:stop
npm run sonar:loop-scheduler:stop
```

## Single check (no loop)

```powershell
npm run sonar:scheduler-watchdog
# or dry-run:
pwsh -File scripts/sonar-agent/run-sonar-scheduler-watchdog.ps1 -Once -DryRun
```

## Logs & status

| File | Purpose |
|------|---------|
| `reports/sonar-loop-scheduler.log` | Scheduler ticks |
| `reports/sonar-scheduler-watchdog.log` | Watchdog repairs |
| `reports/sonar-loop-last-tick.json` | Last tick timestamp |
| Canvas `schedulerStatus` | Synced via `npm run sonar:sync-scheduler` |

## Agent workflow (Cursor chat)

When user reports **Scheduler stoppet**:

1. Run `npm run sonar:loop:start` from `scripts/`
2. Run `npm run sonar:sync-scheduler` — confirm `schedulerRunning: true` in canvas
3. If watchdog not running, `npm run sonar:scheduler-watchdog:start`
4. Append canvas `activityLog`: scheduler + watchdog started

## Do not

- Log `SONAR_TOKEN` or `.env` contents
- Force-push or push to `main`/`staging` (PR-only)
- Replace full `stardesk-watchdog` for release/PR automation

## Related

- Full watchdog: `.cursor/skills/stardesk-watchdog/SKILL.md`
- Sonar fix batches: `.cursor/skills/stardesk-sonar-agent/SKILL.md`
- Prompt: `.cursor/prompts/sonar-scheduler-watchdog.md`
