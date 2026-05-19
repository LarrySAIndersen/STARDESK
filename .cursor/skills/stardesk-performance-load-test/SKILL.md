---
name: stardesk-performance-load-test
description: >-
  Runs headless STARDESK API performance load tests (baseline, soak, stress) with
  ~20 concurrent authenticated virtual users. Use when the user asks for load
  testing, soak/stress runs, JMeter-like API concurrency, p95/error-rate checks,
  or npm load-test scripts.
disable-model-invocation: true
---

# STARDESK performance load testing

Headless Node runner (JMeter-like) against the FastAPI `BASE_URL`. Simulates authenticated journeys: login → tickets list → ticket detail → dashboard/reports.

## Prerequisites

- API reachable at `BASE_URL` (local `http://localhost:8000` or approved staging).
- Node.js 18+ (uses native `fetch`).
- At least one test user in the user pool (up to 20 for full concurrency).

## Layout

| Path | Purpose |
|------|---------|
| [docs/performance-testing.md](../../../docs/performance-testing.md) | Scenarios, thresholds, safety |
| [scripts/load-test/](../../../scripts/load-test/) | Runner, config, env templates |
| `config.mjs` | Env + user pool resolution |
| `run-load-test.mjs` | Single scenario (`baseline` \| `soak` \| `stress`) |
| `run-load-agent.mjs` | Runs all three scenarios sequentially |
| `run-load-agent.ps1` | PowerShell wrapper (same as agent `.mjs`) |
| `.env.loadtest.example` → `.env.loadtest` | Gitignored local config |
| `load-test-users.example.json` → `load-test-users.json` | Gitignored credentials |
| `reports/latest.json` | Last run summary (gitignored) |

## Agent workflow

1. **Confirm target** — Default local/staging. **Never** aim at production URLs without explicit human approval.
2. **Prepare secrets** (from repo root, PowerShell):

   ```powershell
   Copy-Item scripts/load-test/.env.loadtest.example scripts/load-test/.env.loadtest
   Copy-Item scripts/load-test/load-test-users.example.json scripts/load-test/load-test-users.json
   ```

   Edit `.env.loadtest` (`BASE_URL`, `VUS`, thresholds) and `load-test-users.json` (real staging users; never commit).

3. **Run** (cwd for npm is `scripts/`):

   | Goal | Command |
   |------|---------|
   | Quick regression (20 VU, 1 iteration each) | `npm --prefix scripts run load-test` |
   | Sustained load (default 300s) | `npm --prefix scripts run load-test:soak` |
   | Staged ramp 20→40→20 VU | `npm --prefix scripts run load-test:stress` |
   | All scenarios | `npm --prefix scripts run load-test:agent` |

   Or from `scripts/load-test/`:

   ```powershell
   node run-load-test.mjs baseline
   .\run-load-agent.ps1
   ```

4. **Interpret** `scripts/load-test/reports/latest.json`:
   - `latencyMs.p95` vs `thresholds.p95Ms` (default 2000 ms)
   - `errorRatePct` vs `thresholds.errorRatePct` (default 1%)
   - `thresholdBreaches` — non-empty ⇒ exit code 1 (FAIL)
   - `endpointStats` — per-endpoint p50/p95/p99
   - `failureSamples` — first errors for debugging

5. **Report to user** — PASS/FAIL, p95, error %, RPS, breached thresholds, report path.

## Scenarios (defaults)

- **baseline**: `VUS` (default 20), one journey per VU + health check.
- **soak**: `VUS` for `SOAK_DURATION_SECONDS` (default 300).
- **stress**: stages from env (`STRESS_STAGE_*`) — default 20→40→20 VU.

Endpoints (overridable in `.env.loadtest`): `LOGIN_PATH`, `TICKETS_PATH`, `DASHBOARD_PATH`, `HEALTH_PATH`.

## Safety

- Do not commit `load-test-users.json`, `.env.loadtest`, or `Background/Passwords`.
- Heavy runs against production require explicit approval.
- Prefer localhost/staging for routine runs.

## If runs fail

- `User pool file not found` → copy example JSON and add users.
- 401 on login → verify users exist on target; check `BASE_URL`.
- Threshold breaches → inspect `failureSamples` and API logs; tune load or fix regressions.
