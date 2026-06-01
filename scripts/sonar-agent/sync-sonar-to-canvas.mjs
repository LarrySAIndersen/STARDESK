#!/usr/bin/env node
/**
 * Sync Sonar scan results into the Sonar Agent canvas sidecar.
 *
 * Reads reports/sonar-agent-latest.json and merges OPEN security issues
 * into canvases/stardesk-sonar-agent.canvas.data.json (key: stardesk-sonar-agent-v1).
 *
 * Env:
 *   SONAR_CANVAS_DATA_PATH — override canvas.data.json path
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncSchedulerToCanvas } from "./sync-scheduler-to-canvas.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORT_JSON = path.join(REPO_ROOT, "reports", "sonar-agent-latest.json");
const CANVAS_STATE_KEY = "stardesk-sonar-agent-v1";

const home = process.env.USERPROFILE || process.env.HOME || "";
const defaultCanvasDataPath = path.join(
  home,
  ".cursor",
  "projects",
  "c-Users-kjaer-STARDESK-Cursor",
  "canvases",
  "stardesk-sonar-agent.canvas.data.json",
);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function countBySeverity(items) {
  const counts = { BLOCKER: 0, CRITICAL: 0, MAJOR: 0, MINOR: 0, INFO: 0 };
  for (const item of items) {
    if (counts[item.severity] != null) counts[item.severity] += 1;
  }
  return counts;
}

function buildQueueItem(issue, previous) {
  const prev = previous.get(issue.key);
  return {
    key: issue.key,
    rule: issue.rule,
    severity: issue.severity,
    path: issue.path,
    line: issue.line ?? null,
    message: issue.message,
    fixStatus: prev?.fixStatus ?? "open",
    fixNotes: prev?.fixNotes,
    fixedAt: prev?.fixedAt,
  };
}

function summarizeQueue(queue) {
  const open = queue.filter((q) => q.fixStatus === "open" || q.fixStatus === "in_progress").length;
  const fixed = queue.filter((q) => q.fixStatus === "fixed").length;
  const bySeverity = countBySeverity(queue.filter((q) => q.fixStatus !== "fixed" && q.fixStatus !== "wontfix"));
  return {
    vulnerabilities: queue.length,
    open,
    fixed,
    blocker: bySeverity.BLOCKER,
    critical: bySeverity.CRITICAL,
    major: bySeverity.MAJOR,
    minor: bySeverity.MINOR,
  };
}

function main() {
  const canvasDataPath = process.env.SONAR_CANVAS_DATA_PATH || defaultCanvasDataPath;
  const report = readJson(REPORT_JSON);
  if (!report) fail(`Sonar report not found: ${REPORT_JSON}. Run npm run sonar:agent first.`);

  const securityIssues = (report.issues ?? []).filter(
    (issue) =>
      issue.type === "VULNERABILITY" && (issue.status === "OPEN" || issue.status === "CONFIRMED"),
  );
  securityIssues.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const canvasData = readJson(canvasDataPath) ?? {};
  const previous = canvasData[CANVAS_STATE_KEY] ?? {};
  const previousQueue = Array.isArray(previous.queue) ? previous.queue : [];
  const previousByKey = new Map(previousQueue.map((item) => [item.key, item]));

  const queue = securityIssues.map((issue) => buildQueueItem(issue, previousByKey));
  const summary = summarizeQueue(queue);

  const now = Date.now();
  const next = {
    projectKey: report.project_key ?? previous.projectKey ?? "LarrySAIndersen_STARDESK",
    lastScanAt: report.generated_at ?? new Date(now).toISOString(),
    phase: previous.phase ?? "idle",
    scope: previous.scope ?? "security",
    summary,
    queue,
    activityLog: Array.isArray(previous.activityLog) ? previous.activityLog : [],
    lastReportPath: previous.lastReportPath,
    lastReportAt: previous.lastReportAt,
  };

  if (!next.activityLog.some((e) => e.action === "Scan synket fra SonarCloud")) {
    next.activityLog = [
      {
        at: now,
        actor: "agent",
        action: "Scan synket fra SonarCloud",
        detail: `${summary.vulnerabilities} sikkerhedsissues (${summary.blocker} blocker, ${summary.critical} critical)`,
      },
      ...next.activityLog,
    ].slice(0, 80);
  } else {
    next.activityLog = [
      {
        at: now,
        actor: "agent",
        action: "Scan opdateret",
        detail: `${summary.open} åbne · ${summary.fixed} fixed`,
      },
      ...next.activityLog,
    ].slice(0, 80);
  }

  fs.mkdirSync(path.dirname(canvasDataPath), { recursive: true });
  fs.writeFileSync(
    canvasDataPath,
    `${JSON.stringify({ ...canvasData, [CANVAS_STATE_KEY]: next }, null, 2)}\n`,
    "utf8",
  );

  console.log(`Synced ${queue.length} security issues → ${canvasDataPath}`);
  console.log(
    `Open: ${summary.open} · Fixed: ${summary.fixed} · Blocker: ${summary.blocker} · Critical: ${summary.critical}`,
  );

  const { schedulerStatus } = syncSchedulerToCanvas({ canvasDataPath });
  console.log(
    `Scheduler: ${schedulerStatus.schedulerRunning ? "Kører" : "Stoppet"} · Sidste tick: ${schedulerStatus.lastTickAt ?? "—"}`,
  );
}

main();
