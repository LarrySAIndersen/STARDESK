---
name: stardesk-watchdog
description: >-
  STARDESK watchdog — monitor Sonar remediation loop health, staging/main drift,
  stale scans, and CI-green unmerged PRs; auto-repair within safe scope or escalate.
  Use when Sonar loop stalled, staging/main drift, scan is stale, CI green but PR
  unmerged, or user says watchdog, noget staller, loop hænger, eller Sonar kører ikke.
---

# STARDESK Watchdog

Background VM watchdog for the **Sonar remediation loop** and release path. Runs every 15 min; repairs are idempotent.

## When to use

| Trigger | Action |
|---------|--------|
| User: **watchdog**, **noget staller**, **loop hænger**, **Sonar kører ikke**, **CI grøn men ikke merged**, **staging foran main**, **scan for gammel** | Run `-Once -DryRun`, report, then `-Once` or start loop |
| Scheduler stopped or last tick > 60 min | Watchdog restarts scheduler or triggers tick |
| `origin/staging` behind `origin/main` | **Escalate** — log only; no direct push to `staging` (PR-only) |
| Open PR staging→main, CI green | Watchdog merges (Sonar loop exception) |
| Scan > 2 h old, `.env` present | Watchdog runs `npm run sonar:pipeline` |

## What it monitors

1. **Sonar scheduler** — PID `reports/sonar-loop-scheduler.pid`, log `reports/sonar-loop-scheduler.log`
2. **Tick freshness** — `reports/sonar-loop-last-tick.json` (warn > 2× scheduler interval)
3. **Staging sync** — `origin/staging` vs `origin/main` drift
4. **PR merge backlog** — `cursor/sonar-remediation-loop` → `staging`, Flow-2 `staging` → `main`
5. **Scan age** — `reports/sonar-agent-latest.json` (warn > 2 h when Sonar `.env` present)

## How to run

```powershell
powershell -File scripts/stardesk-watchdog.ps1 -Once -DryRun   # test
powershell -File scripts/stardesk-watchdog.ps1                 # start (15 min)
powershell -File scripts/stardesk-watchdog.ps1 -Stop           # stop
cd scripts && npm run watchdog:start
```

Full reference: `docs/stardesk-watchdog.md`

## Auto-repair scope

| Check | Repair |
|-------|--------|
| Scheduler down | Restart `run-sonar-loop-scheduler.ps1` |
| Tick stale (>2× interval) | Run `run-sonar-loop-tick.ps1` |
| Staging behind main | Log + escalate (Jan / manual PR) |
| Sonar loop PR CI green | `gh pr merge` to staging |
| Flow-2 PR CI green | `gh pr merge` staging→main |
| Scan stale (>2 h) | `npm run sonar:pipeline` |

## Escalate (log only)

- **Vercel production env**, prod deploy, or `STARDESK_ENV=production` changes → **Jan**
- Staging behind main (sync needs PR, not direct push)
- Merge conflicts on staging sync
- CI red on open PRs
- Missing `gh` auth or Sonar `.env`
- Deliverable gate / app failures
- Secrets — never log `SONAR_TOKEN`, `DATABASE_URL`, or `.env` contents

## Integration with Sonar remediation loop

Watchdog = **health layer**; loop = **work layer**.

| Component | Path |
|-----------|------|
| Loop prompt (one tick) | `.cursor/prompts/sonar-remediation-loop.md` |
| Loop branch | `cursor/sonar-remediation-loop` |
| Tick emitter | `scripts/sonar-agent/run-sonar-loop-tick.ps1` |
| Scheduler (30 min) | `scripts/sonar-agent/run-sonar-loop-scheduler.ps1` |
| Fix workflow | `.cursor/skills/stardesk-sonar-agent/SKILL.md` |

When watchdog detects stall: restart scheduler → trigger tick → if still stuck, agent reads `sonar-remediation-loop.md` and runs one full tick.

**Sonar loop autonomous override** (narrow): auto-merge on `cursor/sonar-remediation-loop` and Flow-2 when CI green — only for that loop per `docs/pr-only-period.md`.

Stop Sonar scheduler separately:

```powershell
powershell -File scripts/sonar-agent/run-sonar-loop-scheduler.ps1 -Stop
```

## Output

- `reports/watchdog-latest.log`
- `reports/watchdog-latest.json`
- `reports/watchdog.pid`

## Security

- Never log secrets
- No force-push
- Sonar loop exception only for narrow auto-merge scope (see `docs/pr-only-period.md`)
