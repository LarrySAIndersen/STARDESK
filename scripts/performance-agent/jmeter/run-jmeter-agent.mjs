#!/usr/bin/env node
/**
 * JMeter performance agent — API load aligned with STARDESK-performance-50.
 *
 * Requires Apache JMeter on PATH (jmeter or jmeter.bat).
 * Reuses scripts/load-test config for BASE_URL, users, thresholds.
 *
 * Usage:
 *   node performance-agent/jmeter/run-jmeter-agent.mjs [baseline|stress]
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadConfig } from "../../load-test/config.mjs";
import { loadPerfEnv } from "../load-perf-env.mjs";
import {
  DEFAULT_THRESHOLDS,
  thresholdForApiEndpoint,
  API_ENDPOINTS,
} from "../performance-plan.mjs";
import { parseJtlFile, writeUsersCsv, resolveJmeterDir } from "./parse-jtl.mjs";

loadPerfEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const REPORT_JSON = resolve(REPO_ROOT, "reports/performance-jmeter-latest.json");
const JMETER_ARTIFACTS_ROOT = resolve(REPO_ROOT, "artifacts/performance/jmeter");

function relRepoPath(absPath) {
  return relative(REPO_ROOT, absPath).split("\\").join("/");
}

function listHtmlReportFiles(reportDir) {
  if (!existsSync(reportDir)) return [];
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".html") || entry.name.endsWith(".jtl")) {
        files.push(relRepoPath(full));
      }
    }
  }
  walk(reportDir);
  return files.sort();
}

function commandExists(command) {
  const probe = process.platform === "win32" ? "where.exe" : "which";
  const run = spawnSync(probe, [command], { stdio: "ignore", shell: false });
  return run.status === 0;
}

function resolveJmeterCommand() {
  if (commandExists("jmeter")) return "jmeter";
  if (process.platform === "win32" && commandExists("jmeter.bat")) return "jmeter.bat";
  return null;
}

function ensureJmx() {
  const jmxPath = resolve(__dirname, "stardesk-api-baseline.jmx");
  if (!existsSync(jmxPath)) {
    const gen = resolve(__dirname, "generate-jmx.mjs");
    const run = spawnSync(process.execPath, [gen], { stdio: "inherit" });
    if (run.status !== 0) {
      throw new Error("Failed to generate JMeter test plan");
    }
  }
  return jmxPath;
}

function scenarioParams(scenario, config) {
  if (scenario === "stress") {
    const peak = Math.max(...config.stressStages.map((s) => s.vus));
    const duration = config.stressStages.reduce((sum, s) => sum + s.durationSeconds, 0);
    return { vus: peak, durationSeconds: duration, rampSeconds: 30, loops: 1 };
  }
  return {
    vus: config.vus,
    durationSeconds: Number.parseInt(process.env.JMETER_DURATION_SECONDS ?? "60", 10),
    rampSeconds: Number.parseInt(process.env.JMETER_RAMP_SECONDS ?? "10", 10),
    loops: 1,
  };
}

function evaluateThresholds(endpointStats, config) {
  const breaches = [];
  for (const [label, stats] of Object.entries(endpointStats)) {
    const target = thresholdForApiEndpoint(label);
    if (stats.p95 > target) {
      breaches.push(`${label} p95 ${stats.p95}ms > ${target}ms (plan item baseline)`);
    }
    if (stats.errorRatePct > config.thresholds.errorRatePct) {
      breaches.push(
        `${label} error rate ${stats.errorRatePct}% > ${config.thresholds.errorRatePct}%`,
      );
    }
  }
  return breaches;
}

async function main() {
  const jmeterCmd = resolveJmeterCommand();
  if (!jmeterCmd) {
    console.error(
      "JMeter not found on PATH. Install: choco install jmeter OR download from https://jmeter.apache.org/",
    );
    process.exit(2);
  }

  const config = loadConfig();
  const scenario = process.argv[2] || "baseline";
  const params = scenarioParams(scenario, config);

  const jmeterDir = resolveJmeterDir();
  mkdirSync(jmeterDir, { recursive: true });
  const artifactsDir = resolve(JMETER_ARTIFACTS_ROOT, scenario);
  mkdirSync(artifactsDir, { recursive: true });
  const htmlReportDir = resolve(JMETER_ARTIFACTS_ROOT, `report-${scenario}`);

  const usersCsv = resolve(artifactsDir, "users.csv");
  writeUsersCsv(config.users, usersCsv);

  const jmxPath = ensureJmx();
  const jtlPath = resolve(artifactsDir, "results.jtl");

  const jProps = [
    `-JBASE_URL=${config.baseUrl}`,
    `-JUSERS_CSV=${usersCsv}`,
    `-JVUS=${params.vus}`,
    `-JDURATION_SECONDS=${params.durationSeconds}`,
    `-JRAMP_SECONDS=${params.rampSeconds}`,
    `-JLOOPS=${params.loops}`,
    `-JTHINK_TIME_MS=${config.thinkTimeMs}`,
  ];

  console.log(`=== JMeter agent: ${scenario} ===`);
  console.log(`Target: ${config.baseUrl}`);
  console.log(`VUs: ${params.vus}, duration: ${params.durationSeconds}s`);

  const run = spawnSync(
    jmeterCmd,
    ["-n", "-t", jmxPath, "-l", jtlPath, "-e", "-o", htmlReportDir, ...jProps],
    { stdio: "inherit", env: process.env },
  );

  if (!existsSync(jtlPath)) {
    console.error("JMeter did not produce JTL output");
    process.exit(run.status ?? 1);
  }

  const htmlFiles = listHtmlReportFiles(htmlReportDir);
  const htmlIndex = htmlFiles.find((f) => f.endsWith("index.html")) ?? null;

  const parsed = parseJtlFile(jtlPath);
  const thresholdBreaches = evaluateThresholds(parsed.byLabel, config);

  const report = {
    agent: "jmeter",
    scenario,
    generatedAt: new Date().toISOString(),
    target: config.baseUrl,
    params,
    planEndpoints: API_ENDPOINTS,
    thresholds: DEFAULT_THRESHOLDS.api,
    ...parsed.summary,
    endpointStats: parsed.byLabel,
    thresholdBreaches,
    jtlPath: relRepoPath(jtlPath),
    pass: thresholdBreaches.length === 0 && (run.status ?? 1) === 0,
    artifacts: {
      dir: relRepoPath(artifactsDir),
      jtl: relRepoPath(jtlPath),
      htmlReportDir: relRepoPath(htmlReportDir),
      htmlIndex,
      htmlFiles,
      usersCsv: relRepoPath(usersCsv),
    },
  };

  mkdirSync(dirname(REPORT_JSON), { recursive: true });
  writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");

  console.log("");
  console.log(`Requests: ${report.totalRequests}, errors: ${report.totalErrors} (${report.errorRatePct}%)`);
  console.log(
    `Latency p50/p95/p99: ${report.latencyMs.p50}/${report.latencyMs.p95}/${report.latencyMs.p99} ms`,
  );
  console.log(`Result: ${report.pass ? "PASS" : "FAIL"}`);
  for (const breach of thresholdBreaches) {
    console.log(` - ${breach}`);
  }
  console.log(`Report: ${REPORT_JSON}`);

  process.exit(report.pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(2);
});
