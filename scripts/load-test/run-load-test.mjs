import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.mjs";

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function percentile(sortedValues, pct) {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((pct / 100) * sortedValues.length) - 1)
  );
  return sortedValues[index];
}

class Metrics {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.startedAt = new Date().toISOString();
    this.startedMs = performance.now();
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.statusCodes = {};
    this.endpointLatencies = {};
    this.failureSamples = [];
  }

  record({ endpoint, status, ok, durationMs, errorMessage }) {
    this.totalRequests += 1;
    this.statusCodes[String(status)] = (this.statusCodes[String(status)] || 0) + 1;
    if (!this.endpointLatencies[endpoint]) {
      this.endpointLatencies[endpoint] = [];
    }
    this.endpointLatencies[endpoint].push(durationMs);
    if (!ok) {
      this.totalErrors += 1;
      if (this.failureSamples.length < 20) {
        this.failureSamples.push({ endpoint, status, errorMessage });
      }
    }
  }

  finalize(extra = {}) {
    const elapsedMs = Math.max(1, performance.now() - this.startedMs);
    const allLatencies = Object.values(this.endpointLatencies).flat().sort((a, b) => a - b);
    const errorRatePct = this.totalRequests === 0 ? 0 : (this.totalErrors / this.totalRequests) * 100;
    const summary = {
      scenario: this.name,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      elapsedMs: Number(elapsedMs.toFixed(2)),
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      errorRatePct: Number(errorRatePct.toFixed(3)),
      rps: Number((this.totalRequests / (elapsedMs / 1000)).toFixed(3)),
      latencyMs: {
        p50: Number(percentile(allLatencies, 50).toFixed(2)),
        p95: Number(percentile(allLatencies, 95).toFixed(2)),
        p99: Number(percentile(allLatencies, 99).toFixed(2)),
      },
      statusCodes: this.statusCodes,
      endpointStats: Object.fromEntries(
        Object.entries(this.endpointLatencies).map(([endpoint, values]) => {
          const sorted = [...values].sort((a, b) => a - b);
          return [
            endpoint,
            {
              count: sorted.length,
              p50: Number(percentile(sorted, 50).toFixed(2)),
              p95: Number(percentile(sorted, 95).toFixed(2)),
              p99: Number(percentile(sorted, 99).toFixed(2)),
            },
          ];
        })
      ),
      failureSamples: this.failureSamples,
      thresholds: this.config.thresholds,
      thresholdBreaches: [],
      ...extra,
    };

    if (summary.latencyMs.p95 > this.config.thresholds.p95Ms) {
      summary.thresholdBreaches.push(
        `p95 latency ${summary.latencyMs.p95}ms exceeds ${this.config.thresholds.p95Ms}ms`
      );
    }
    if (summary.errorRatePct > this.config.thresholds.errorRatePct) {
      summary.thresholdBreaches.push(
        `error rate ${summary.errorRatePct}% exceeds ${this.config.thresholds.errorRatePct}%`
      );
    }
    return summary;
  }
}

const TICKET_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Safe filename segment for report paths (load-test summary.scenario is config-controlled). */
const SCENARIO_FILE_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

function ticketIdForApiPath(raw) {
  const id = String(raw ?? "").trim();
  if (!TICKET_ID_RE.test(id)) {
    throw new Error("Invalid ticket id from API");
  }
  return id;
}

function safeScenarioFileSegment(scenario) {
  const normalized = String(scenario ?? "run")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const segment = normalized || "run";
  if (!SCENARIO_FILE_RE.test(segment)) {
    return "run";
  }
  return segment;
}

async function measuredFetch(metrics, endpoint, url, options = {}, parseJson = false) {
  const started = performance.now();
  try {
    const response = await fetch(url, options);
    const durationMs = performance.now() - started;
    let body = null;
    if (parseJson) {
      try {
        body = await response.json();
      } catch {
        body = null;
      }
    } else {
      await response.arrayBuffer();
    }

    metrics.record({
      endpoint,
      status: response.status,
      ok: response.ok,
      durationMs,
      errorMessage: response.ok ? undefined : `HTTP ${response.status}`,
    });

    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    const durationMs = performance.now() - started;
    metrics.record({
      endpoint,
      status: 0,
      ok: false,
      durationMs,
      errorMessage: String(error?.message || error),
    });
    return { ok: false, status: 0, body: null };
  }
}

function nextUser(users, vuId, iteration) {
  const index = (vuId + iteration) % users.length;
  return users[index];
}

async function runUserJourney(config, metrics, vuId, iteration) {
  const user = nextUser(config.users, vuId, iteration);
  const login = await measuredFetch(
    metrics,
    "login",
    `${config.baseUrl}${config.loginPath}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: user.email, password: user.password }),
    },
    true
  );

  if (!login.ok || !login.body?.access_token) {
    return;
  }

  const authHeaders = {
    authorization: `Bearer ${login.body.access_token}`,
  };

  const list = await measuredFetch(
    metrics,
    "tickets-list",
    `${config.baseUrl}${config.ticketsPath}`,
    {
      method: "GET",
      headers: authHeaders,
    },
    true
  );

  let firstTicketId = null;
  if (list.ok && Array.isArray(list.body) && list.body.length > 0) {
    const picked = list.body[0];
    firstTicketId = picked?.id ? String(picked.id) : null;
  }

  if (firstTicketId && TICKET_ID_RE.test(firstTicketId)) {
    const ticketId = ticketIdForApiPath(firstTicketId);
    await measuredFetch(
      metrics,
      "ticket-detail",
      `${config.baseUrl}${config.ticketsPath}/${ticketId}`,
      {
        method: "GET",
        headers: authHeaders,
      },
      false
    );
  }

  await measuredFetch(
    metrics,
    "dashboard",
    `${config.baseUrl}${config.dashboardPath}`,
    {
      method: "GET",
      headers: authHeaders,
    },
    false
  );
}

async function runConstantScenario({
  scenarioName,
  config,
  vus,
  durationSeconds,
  iterationsPerVu,
  includeHealthCheck,
  externalMetrics,
}) {
  const metrics = externalMetrics || new Metrics(scenarioName, config);
  if (includeHealthCheck) {
    await measuredFetch(
      metrics,
      "health",
      `${config.baseUrl}${config.optionalHealthPath}`,
      { method: "GET" },
      false
    );
  }

  const stopAt = durationSeconds ? Date.now() + durationSeconds * 1000 : null;
  const workers = [];
  for (let vu = 0; vu < vus; vu += 1) {
    workers.push(
      (async () => {
        let iteration = 0;
        while (true) {
          if (iterationsPerVu !== null && iteration >= iterationsPerVu) {
            break;
          }
          if (stopAt !== null && Date.now() >= stopAt) {
            break;
          }
          await runUserJourney(config, metrics, vu, iteration);
          iteration += 1;
          if (config.thinkTimeMs > 0) {
            await sleep(config.thinkTimeMs);
          }
        }
      })()
    );
  }

  await Promise.all(workers);
  if (externalMetrics) {
    return null;
  }
  return metrics.finalize({ vus, durationSeconds, iterationsPerVu });
}

async function runStressScenario(config) {
  const scenarioName = "stress";
  const metrics = new Metrics(scenarioName, config);
  await measuredFetch(
    metrics,
    "health",
    `${config.baseUrl}${config.optionalHealthPath}`,
    { method: "GET" },
    false
  );

  for (const stage of config.stressStages) {
    await runConstantScenario({
      scenarioName: `stress-stage-${stage.vus}vus`,
      config,
      vus: stage.vus,
      durationSeconds: stage.durationSeconds,
      iterationsPerVu: null,
      includeHealthCheck: false,
      externalMetrics: metrics,
    });
  }

  return metrics.finalize({
    stages: config.stressStages,
    targetPeakVus: Math.max(...config.stressStages.map((s) => s.vus)),
  });
}

function printSummary(summary) {
  const pass = summary.thresholdBreaches.length === 0;
  console.log("");
  console.log(`Scenario: ${summary.scenario}`);
  console.log(`Requests: ${summary.totalRequests}`);
  console.log(`Errors: ${summary.totalErrors} (${summary.errorRatePct}%)`);
  console.log(`RPS: ${summary.rps}`);
  console.log(
    `Latency (ms): p50=${summary.latencyMs.p50} p95=${summary.latencyMs.p95} p99=${summary.latencyMs.p99}`
  );
  console.log(`Status codes: ${JSON.stringify(summary.statusCodes)}`);
  console.log(
    `Thresholds: p95<=${summary.thresholds.p95Ms}ms, error<=${summary.thresholds.errorRatePct}%`
  );
  console.log(`Result: ${pass ? "PASS" : "FAIL"}`);
  if (!pass) {
    for (const breach of summary.thresholdBreaches) {
      console.log(` - ${breach}`);
    }
  }
}

function writeReport(summary) {
  const loadTestDir = dirname(fileURLToPath(import.meta.url));
  const reportsDir = resolve(loadTestDir, "reports");
  mkdirSync(reportsDir, { recursive: true });
  const path = resolve(reportsDir, "latest.json");
  writeFileSync(path, JSON.stringify(summary, null, 2), "utf8");

  const repoReportsDir = resolve(loadTestDir, "../../reports");
  mkdirSync(repoReportsDir, { recursive: true });
  const latestPath = resolve(repoReportsDir, "performance-load-test-latest.json");
  writeFileSync(latestPath, JSON.stringify(summary, null, 2), "utf8");
  const stamp = (summary.finishedAt ?? new Date().toISOString()).replaceAll(":", "-").replaceAll(".", "-");
  const scenarioSegment = safeScenarioFileSegment(summary.scenario);
  writeFileSync(
    resolve(repoReportsDir, `load-test-${scenarioSegment}-${stamp}.json`),
    JSON.stringify(summary, null, 2),
    "utf8",
  );

  return path;
}

async function main() {
  const config = loadConfig();
  const scenario = process.argv[2] || "baseline";
  if (!config.baseUrl) {
    throw new Error("BASE_URL is missing.");
  }

  let summary;
  if (scenario === "baseline") {
    summary = await runConstantScenario({
      scenarioName: "baseline",
      config,
      vus: config.vus,
      durationSeconds: null,
      iterationsPerVu: 1,
      includeHealthCheck: true,
    });
  } else if (scenario === "soak") {
    summary = await runConstantScenario({
      scenarioName: "soak",
      config,
      vus: config.vus,
      durationSeconds: config.soakDurationSeconds,
      iterationsPerVu: null,
      includeHealthCheck: true,
    });
  } else if (scenario === "stress") {
    summary = await runStressScenario(config);
  } else {
    throw new Error(`Unknown scenario "${scenario}"`);
  }

  printSummary(summary);
  const reportPath = writeReport(summary);
  console.log(`Report: ${reportPath}`);
  process.exit(summary.thresholdBreaches.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(2);
});
