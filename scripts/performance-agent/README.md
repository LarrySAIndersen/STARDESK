# STARDESK Performance Agent

Swarm of **JMeter** (API load) and **Playwright** (UI Web Vitals) agents aligned with [`STARDESK-performance-50.md`](../../workboard/constitution/STARDESK-performance-50.md).

## Architecture

```
run-performance-pipeline.mjs
  ├── run-performance-agent.mjs     (parallel swarm)
  │     ├── jmeter/run-jmeter-agent.mjs
  │     └── playwright/run-playwright-perf-agent.mjs
  ├── build-performance-report.mjs  (merge → reports/)
  └── sync-performance-to-canvas.mjs
```

## Prerequisites

1. **Load-test config** — copy `scripts/load-test/.env.loadtest.example` → `.env.loadtest` and user pool.
2. **JMeter** — `jmeter -v` on PATH ([Apache JMeter 5.6+](https://jmeter.apache.org/)).
3. **Playwright** — `npm ci` in `scripts/` (chromium for perf agent).

Optional: copy `performance-agent/.env.example` → `.env` for overrides.

## Quick start

```bash
# Full pipeline (JMeter + Playwright + report + canvas)
npm --prefix scripts run perf:pipeline

# Swarm only
npm --prefix scripts run perf:agent

# Individual agents
npm --prefix scripts run perf:jmeter
npm --prefix scripts run perf:playwright
```

## Scenarios

| Agent | Scenario | Endpoints / routes | Plan items |
|-------|----------|-------------------|------------|
| JMeter | baseline | login → tickets → detail → dashboard → categories → kanban | 1, 5, 6, 13, 25, 50 |
| JMeter | stress | Peak VUs from load-test stress stages | 9, 50 |
| Playwright | UI perf | /tickets, kanban, dashboard, admin/categories | 16, 19, 25, 31 |

## Output

| File | Description |
|------|-------------|
| `reports/performance-jmeter-latest.json` | API latency per endpoint |
| `reports/performance-playwright-latest.json` | Web Vitals per route |
| `reports/performance-agent-latest.json` | Merged swarm report |
| `reports/performance-agent-latest.md` | Human-readable + 50-punkts coverage table |

Canvas sidecar: `stardesk-performance-agent.canvas.data.json`

## Deling med kolleger

Efter pipeline eller rapport:

```bash
npm --prefix scripts run perf:share
```

Åbn **`reports/performance-share-pack.zip`** (eller `reports/performance-share/latest/index.html`) — selvstændig HTML, `FINDINGS.md` til Slack/mail, og `artifacts/` med optagelser. Ingen adgangskoder eller tokens.

## Thresholds

Default P95 targets in `performance-plan.mjs` (item 50). Override via load-test `.env.loadtest`:

- `THRESHOLD_P95_MS=2000`
- `THRESHOLD_ERROR_RATE_PCT=1`

## Safety

- Default target: `localhost:8000` / `localhost:3000`
- Do not run stress against production without explicit approval
- JMeter generates `users.csv` in gitignored `jmeter/artifacts/`
