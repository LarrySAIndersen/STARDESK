#!/usr/bin/env node
/**
 * Sync reports/coverage-agent-latest.json into Coverage Agent canvas sidecar.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCanvasDataPath } from "./resolve-canvas-data-path.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORT_JSON = path.join(REPO_ROOT, "reports/coverage-agent-latest.json");
const CANVAS_STATE_KEY = "stardesk-coverage-agent-v1";

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  const report = readJson(REPORT_JSON);
  if (!report) {
    console.error(`Report not found: ${REPORT_JSON}. Run coverage:pipeline first.`);
    process.exit(1);
  }

  const canvasDataPath = resolveCanvasDataPath();
  const canvasData = readJson(canvasDataPath) ?? {};
  const previous = canvasData[CANVAS_STATE_KEY] ?? {};

  const prevLine = previous.summary?.line_rate;
  const delta =
    prevLine != null ? Math.round((report.summary.line_rate - prevLine) * 10) / 10 : null;

  const activityLog = [
    ...(Array.isArray(previous.activityLog) ? previous.activityLog : []),
    {
      at: report.generated_at,
      actor: "coverage-agent",
      action: "scan",
      detail: `Line ${report.summary.line_rate}%${delta != null ? ` (${delta >= 0 ? "+" : ""}${delta})` : ""} · branch ${report.summary.branch_rate}% · ${report.summary.files_total} files`,
    },
  ].slice(-80);

  canvasData[CANVAS_STATE_KEY] = {
    lastScanAt: report.generated_at,
    phase: "report",
    summary: {
      line_rate: report.summary.line_rate,
      branch_rate: report.summary.branch_rate,
      statements: report.summary.statements,
      covered_lines: report.summary.covered_lines,
      missing_lines: report.summary.missing_lines,
      branches: report.summary.branches,
      covered_branches: report.summary.covered_branches,
      files_total: report.summary.files_total,
      files_zero_coverage: report.summary.files_zero_coverage,
      files_below_50: report.summary.files_below_50,
      files_at_least_80: report.summary.files_at_least_80,
    },
    areas: report.areas,
    priorities: report.priorities,
    activityLog,
    lastReportPath: "reports/coverage-agent-latest.md",
    lastReportAt: report.generated_at,
    ci: {
      pytest_fail_under: 85,
      sonar_new_code_min: 80,
      web_in_sonar_gate: false,
    },
  };

  fs.mkdirSync(path.dirname(canvasDataPath), { recursive: true });
  fs.writeFileSync(canvasDataPath, JSON.stringify(canvasData, null, 2), "utf8");
  console.log(`Canvas synced: ${canvasDataPath}`);
}

main();
