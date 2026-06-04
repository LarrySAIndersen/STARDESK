#!/usr/bin/env node
/**
 * Sync performance-agent-latest.json into canvas sidecar.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCanvasDataPath } from "./resolve-canvas-data-path.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORT_JSON = path.join(REPO_ROOT, "reports/performance-agent-latest.json");
const CANVAS_STATE_KEY = "stardesk-performance-agent-v1";

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  const report = readJson(REPORT_JSON);
  if (!report) {
    console.error(`Report not found: ${REPORT_JSON}. Run perf:pipeline first.`);
    process.exit(1);
  }

  const canvasDataPath = resolveCanvasDataPath();
  const canvasData = readJson(canvasDataPath) ?? {};
  const previous = canvasData[CANVAS_STATE_KEY] ?? {};

  const queue = (report.planCoverage ?? []).map((item) => {
    const prev = (previous.queue ?? []).find((q) => q.n === item.n);
    return {
      n: item.n,
      title: item.title,
      tier: item.tier,
      measurable: item.measurable,
      agent: item.agent,
      status: item.status,
      evidence: item.evidence,
      fixStatus: prev?.fixStatus ?? (item.status === "breach" ? "open" : "baseline"),
      fixNotes: prev?.fixNotes,
    };
  });

  const next = {
    lastRunAt: report.generatedAt,
    pass: report.pass,
    summary: report.summary,
    jmeter: report.jmeter
      ? {
          target: report.jmeter.target,
          p95: report.jmeter.latencyMs?.p95,
          totalRequests: report.jmeter.totalRequests,
          pass: report.jmeter.pass,
        }
      : null,
    playwright: report.playwright
      ? {
          target: report.playwright.target,
          pass: report.playwright.pass,
          scenarioStats: report.playwright.scenarioStats,
        }
      : null,
    queue,
    activityLog: [
      ...(Array.isArray(previous.activityLog) ? previous.activityLog : []),
      {
        at: report.generatedAt,
        action: "swarm_run",
        pass: report.pass,
        breaches: report.summary?.breaches ?? 0,
      },
    ].slice(-50),
  };

  canvasData[CANVAS_STATE_KEY] = next;
  fs.mkdirSync(path.dirname(canvasDataPath), { recursive: true });
  fs.writeFileSync(canvasDataPath, JSON.stringify(canvasData, null, 2), "utf8");

  console.log(`Synced performance agent → ${canvasDataPath}`);
  console.log(
    `Plan: ${report.summary?.measuredOk ?? 0}/${report.summary?.measurableItems ?? 0} measurable items OK`,
  );
}

main();
