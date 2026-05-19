# Performance Testing

## Objectives
- Validate that authenticated API flows remain stable under concurrent load.
- Compare short peak behavior (stress) and sustained behavior (soak).
- Produce repeatable, headless test runs with machine-readable output for CI.

## Scenarios
- `baseline`: `20` VUs, `1` journey per VU (quick regression check).
- `stress`: staged load `0 -> 20 -> 40 -> 20` VUs over ~2.5 minutes.
- `soak`: `20` VUs sustained for `5` to `10` minutes (default `300s`, configurable).

Each VU performs:
1. `POST /api/v1/auth/login`
2. `GET /api/v1/tickets`
3. `GET /api/v1/tickets/{id}` when an id is returned
4. `GET /api/v1/reports/dashboard`
5. Optional `GET /health` baseline probe

## Thresholds (default pass/fail)
- p95 latency `< 2000 ms`
- error rate `< 1%`

If either threshold is breached, the runner exits non-zero.

## Install k6 (Windows)

k6 is required for destructive load scripts. See [destructive-testing.md](./destructive-testing.md#install-k6-windows) for install steps and `k6 version`. 

## Configuration
Location: `scripts/load-test`

1. Copy `.env.loadtest.example` to `.env.loadtest`
2. Copy `load-test-users.example.json` to `load-test-users.json`
3. Add up to 20 distinct test users in `load-test-users.json`

Supported config:
- `BASE_URL` API target (use local or staging by default)
- `VUS`, `SOAK_DURATION_SECONDS`, stress stage VU/duration values
- `THRESHOLD_P95_MS`, `THRESHOLD_ERROR_RATE_PCT`
- `LOAD_TEST_USERS` (inline JSON) or `LOAD_TEST_USERS_FILE` (JSON file path)

## How To Run (Headless)
From repository root:

- Baseline: `npm --prefix scripts run load-test`
- Stress: `npm --prefix scripts run load-test:stress`
- Soak: `npm --prefix scripts run load-test:soak`
- All scenarios (agent wrapper): `npm --prefix scripts run load-test:agent`

Example with 20 VUs:

`$env:VUS=20; npm --prefix scripts run load-test:stress`

## Output
- Console summary: RPS, p50/p95/p99, error %, status-code counts.
- JSON report: `scripts/load-test/reports/latest.json`

`latest.json` is overwritten on each run.

## Safety / Approval
- Do not run heavy tests against production without explicit approval.
- Prefer localhost or staging targets for routine testing.
- Never commit real credentials or local user pool files.
