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
| User: **watchdog**, **noget staller**, **loop hænger** | Run `-Once -DryRun`, then start watchdog |
| Scheduler stopped or last tick > 60 min | Watchdog restarts scheduler or triggers tick |
| `origin/staging` behind `origin/main` | Watchdog merges main into staging |
| Open PR staging→main, CI green | Watchdog merges (Sonar loop exception) |
| Scan > 2 h old, `.env` present | Watchdog runs `npm run sonar:pipeline` |

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
| Staging behind main | Merge `origin/main` → staging, push |
| Sonar loop PR CI green | `gh pr merge` to staging |
| Flow-2 PR CI green | `gh pr merge` staging→main |
| Scan stale (>2 h) | `npm run sonar:pipeline` |

## Escalate (log only)

- Merge conflicts on staging sync
- CI red on open PRs
- Missing `gh` auth or Sonar `.env`
- Deliverable gate / app failures

## Output

- `reports/watchdog-latest.log`
- `reports/watchdog-latest.json`
- `reports/watchdog.pid`

## Security

- Never log secrets
- No force-push
- Sonar loop exception only for narrow auto-merge scope (see `docs/pr-only-period.md`)
