---
name: stardesk-destructive-testing
description: >-
  Runs STARDESK destructive and abuse tests (k6 spike/stress-to-failure/auth-flood/
  payload-bomb, pytest -m destructive, optional Schemathesis). Use when the user asks
  for destructive testing, stress-to-failure, auth flooding, API fuzzing, or
  ALLOW_DESTRUCTIVE-guarded runs.
disable-model-invocation: true
---

# STARDESK destructive testing

Abuse and failure-mode tests **outside** normal load-test SLO checks. Frameworks: **k6** (external), **pytest** (`-m destructive`), optional **Schemathesis** (OpenAPI).

## Prerequisites

- Approved target (localhost/staging strongly preferred).
- For non-local `BASE_URL`: set `ALLOW_DESTRUCTIVE=1` and obtain explicit approval before production-like hosts.
- **k6** installed for JS scenarios: https://k6.io/docs/get-started/installation/
- Python dev deps in `apps/api` for pytest (`uv sync --group dev` or `pip install -e ".[dev]"`).

## Layout

| Path | Purpose |
|------|---------|
| [docs/destructive-testing.md](../../../docs/destructive-testing.md) | Scenarios, guards, commands |
| [scripts/load-test/destructive/](../../../scripts/load-test/destructive/) | k6 scripts |
| `run-destructive-agent.mjs` | Orchestrator (k6 + pytest) |
| `run-destructive-agent.ps1` | PowerShell wrapper |
| `apps/api/tests/destructive/` | Pytest `destructive` (live API + user pool) |

Shared config: reuse [scripts/load-test/config.mjs](../../../scripts/load-test/config.mjs) and `.env.loadtest` for `BASE_URL`.

## ALLOW_DESTRUCTIVE guard

| Target | Requirement |
|--------|-------------|
| `localhost` / `127.0.0.1` | Allowed without flag |
| Staging / other hosts | `ALLOW_DESTRUCTIVE=1` |
| Production-like (`*.vercel.app`, `APP_ENV=production`) | `ALLOW_DESTRUCTIVE=1` **and** explicit human approval |

Orchestrator exits `2` if guard blocks the run.

## Agent workflow

1. **Confirm scope** — Destructive only on approved environments; warn user about data/load impact.
2. **Configure** — Same as performance tests: copy `.env.loadtest.example` → `.env.loadtest`, set `BASE_URL`.
3. **Run orchestrator** (repo root):

   ```powershell
   $env:ALLOW_DESTRUCTIVE = "1"   # required for non-local
   npm --prefix scripts run load-test:destructive
   ```

   Or:

   ```powershell
   cd scripts/load-test
   $env:ALLOW_DESTRUCTIVE = "1"
   node run-destructive-agent.mjs
   ```

4. **Run pytest only** (live API at `BASE_URL`, needs user pool):

   ```powershell
   $env:ALLOW_DESTRUCTIVE = "1"
   $env:BASE_URL = "http://localhost:8000"
   npm --prefix scripts run test:destructive
   ```

   Skips if API `/health` is unreachable or `load-test-users.json` is missing.

5. **Optional Schemathesis** (if installed):

   ```powershell
   schemathesis run "$env:BASE_URL/openapi.json" --base-url $env:BASE_URL --checks all
   ```

6. **Interpret** — k6 console output; pytest pass/fail; no unified JSON report (unlike `reports/latest.json` for load tests).

## k6 scenarios (`scripts/load-test/destructive/`)

| Script | Intent |
|--------|--------|
| `spike.js` | Sudden VU spike |
| `stress-to-failure.js` | Ramp until errors dominate |
| `auth-flood.js` | High-rate login attempts |
| `payload-bomb.js` | Oversized / malformed bodies |

Run individually:

```powershell
k6 run -e BASE_URL=http://localhost:8000 scripts/load-test/destructive/spike.js
```

## Pytest destructive tests

- Marker: `destructive` (registered in `apps/api/pyproject.toml`).
- Skipped unless `ALLOW_DESTRUCTIVE=1`.
- Integration-style checks against `BASE_URL` / `DESTRUCTIVE_API_BASE_URL` (not in-process ASGI).

## Safety

- Never commit real passwords or `Background/Passwords`.
- Do not run against production without written approval.
- Coordinate with ops — tests may spike CPU, connection pools, and auth rate limits.

## If runs fail

- `k6: command not found` → install k6 or run pytest-only path.
- Guard exit `2` → set `ALLOW_DESTRUCTIVE=1` or use localhost.
- Pytest all skipped → same flag missing.
