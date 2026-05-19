# Destructive Testing

Abuse, spike, and failure-mode tests for STARDESK. **Not** pass/fail SLO load tests â€” see [performance-testing.md](./performance-testing.md).

## Frameworks

| Tool | Location | Scenarios |
|------|----------|-----------|
| k6 | `scripts/load-test/destructive/*.js` | spike, stress-to-failure, auth-flood, payload-bomb, aggressive non-brute scenarios |
| pytest | `apps/api/tests/destructive/*.py` | `-m destructive` |
| Schemathesis (optional) | CLI against `/openapi.json` | OpenAPI fuzzing |

## ALLOW_DESTRUCTIVE guard

- **localhost / 127.0.0.1**: runs allowed without the flag.
- **Any other host**: set `ALLOW_DESTRUCTIVE=1`.
- **Production-like targets** (`*.vercel.app`, `APP_ENV=production`): require explicit approval even with the flag.

The orchestrator (`run-destructive-agent.mjs`) enforces this before k6 or pytest.


## Install k6 (Windows)

Install the Grafana k6 CLI, then verify it in a **new** terminal (PATH updates after install):

```powershell
winget install GrafanaLabs.k6 --accept-package-agreements --accept-source-agreements
# or: choco install k6 -y

k6 version
```

Preflight (exits 1 if k6 is missing):

```powershell
powershell -File scripts/load-test/check-k6.ps1
```

Default install location: `C:\Program Files\k6\k6.exe`.


## Configuration

Reuse load-test env (from `scripts/load-test`):

1. Copy `.env.loadtest.example` â†’ `.env.loadtest`
2. Set `BASE_URL` to local or approved staging

k6 reads `BASE_URL` from the environment (`-e BASE_URL=...`).

## How to run

From repository root:

```powershell
# All k6 destructive scripts + pytest destructive (non-local needs flag)
$env:ALLOW_DESTRUCTIVE = "1"
npm --prefix scripts run load-test:destructive

# Aggressive non-brute k6 suite only
npm --prefix scripts run load-test:destructive:aggressive

# Pytest only
npm --prefix scripts run test:destructive

# Aggressive pytest destructive additions
pytest -m destructive apps/api/tests/destructive/test_aggressive_api.py -q
```

Single k6 script:

```powershell
k6 run -e BASE_URL=http://localhost:8000 scripts/load-test/destructive/spike.js
```

Optional Schemathesis (install separately):

```powershell
$env:ALLOW_DESTRUCTIVE = "1"
bash scripts/destructive-api/run-schemathesis.sh
```

## Aggressive (Non-Brute) Coverage

`scripts/load-test/destructive/aggressive-scenarios.js` intentionally increases pressure without brute-force behavior:

- `parallel-writes`: 10 VUs mutate the same ticket (`PATCH /priority`, `PATCH /status`, `PATCH /assignment`, `POST /slack-push`) and tolerate controlled conflict/validation errors (`400/409/422`) while failing on `5xx` spikes.
- `state-machine`: rapid status transitions stress transition correctness and race handling.
- `payload-edge`: duplicate keys, deep nested JSON, control-character input, and wrong content-types validate parser and schema rejection paths.
- `authz-probe`: submitter/end-user token probes admin routes and must stay in `401/403`, never `5xx`.
- `burst-read`: 30 parallel ticket-detail reads validate p95 under read burst pressure (without login flood patterns).

Aggressive in this repo means **targeted stateful abuse and boundary probing**. It explicitly excludes:

- credential spraying,
- infinite login loops,
- DDoS-style unbounded floods.

## Aggressive Pytest Cases

`apps/api/tests/destructive/test_aggressive_api.py` adds:

- double promote on knowledge article conversion,
- double slack push on same ticket,
- assign and close race on same ticket,
- malicious query parameters (`scope=../../etc`) rejection behavior,
- SQL-ish search strings (`q`) asserting safe non-`5xx` handling,
- submitter token admin-route authorization checks.

## Safety

- Do not run against production without explicit approval.
- Never commit credentials (`load-test-users.json`, `.env.loadtest`, `Background/Passwords`).
- Expect elevated errors, latency, and possible rate limiting â€” monitor the target environment.
- Default target is local (`http://127.0.0.1:8000` / `BASE_URL`) and non-local runs require `ALLOW_DESTRUCTIVE=1`.
