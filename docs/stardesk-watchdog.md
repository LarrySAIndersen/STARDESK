# STARDESK Watchdog

Minimal VM watchdog that keeps the Sonar remediation loop and release path healthy. It orchestrates existing scripts — it does not duplicate Sonar fix logic.

## What it monitors

| Check | Threshold | Auto-fix |
|-------|-----------|----------|
| Sonar loop scheduler | Process dead / no PID file | Restart `scripts/sonar-agent/run-sonar-loop-scheduler.ps1` |
| Sonar tick freshness | Last tick > 2× interval (60 min) | Run `run-sonar-loop-tick.ps1` |
| Staging sync | `origin/staging` behind `origin/main` | Log + escalate (no direct push) |
| Flow-2 prod PR | Open PR `staging`→`main`, CI green | `gh pr merge` (Sonar loop exception) |
| Sonar scan age | Last scan > 2 h, `.env` present | `npm run sonar:pipeline` in `scripts/` |

Repairs are idempotent. No force-push. Secrets are never written to logs.

## Run

From repo root (Windows / Cloud Agent VM):

```powershell
# Single check (safe test)
pwsh scripts/stardesk-watchdog.ps1 -Once -DryRun

# Start background loop (default 15 min)
pwsh scripts/stardesk-watchdog.ps1

# Or via npm from scripts/
cd scripts && npm run watchdog:start
```

Linux / Git Bash:

```bash
bash scripts/stardesk-watchdog.sh --once --dry-run
bash scripts/stardesk-watchdog.sh
```

## Stop

```powershell
pwsh scripts/stardesk-watchdog.ps1 -Stop
# or
cd scripts && npm run watchdog:stop
```

Also stops the Sonar loop scheduler:

```powershell
pwsh scripts/sonar-agent/run-sonar-loop-scheduler.ps1 -Stop
```

## Output

- `reports/watchdog-latest.log` — human-readable log
- `reports/watchdog-latest.json` — last 100 check runs (JSON)
- `reports/watchdog.pid` — background watchdog PID

## Scope & escalation

**Auto-fixes (Sonar loop / release path only):**

- Restart stalled scheduler or trigger a tick
- Merge green Sonar loop PR to `staging` and Flow-2 `staging`→`main` (Sonar loop exception)
- Re-run Sonar pipeline when scan is stale

**Escalates (log only — no auto-fix):**

- Staging behind main (needs PR sync — PR-only, no direct push)
- **Vercel production env** or prod deploy → Jan
- CI red on open PRs
- Missing `gh` auth or Sonar `.env`
- Deliverable gate / app failures (not in watchdog scope)

## Related

- Sonar tick: `scripts/sonar-agent/run-sonar-loop-tick.ps1`
- Sonar scheduler (30 min): `scripts/sonar-agent/run-sonar-loop-scheduler.ps1`
- Prompt: `.cursor/prompts/sonar-remediation-loop.md`
- PR policy: `docs/pr-only-period.md`
