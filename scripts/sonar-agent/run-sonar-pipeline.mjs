#!/usr/bin/env node
/**
 * Sonar Security Agent pipeline: scan → sync canvas → structured report.
 *
 *   node run-sonar-pipeline.mjs [scope]
 *
 * Scope: all | api | web (default all)
 *
 * Env: SONAR_* — see .env.example
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSonarEnv } from "./load-sonar-env.mjs";

loadSonarEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORT_DIR = path.join(REPO_ROOT, "reports");
const SECURITY_REPORT = path.join(REPORT_DIR, "sonar-security-latest.md");

function runNode(scriptName, args = []) {
  const scriptPath = path.join(__dirname, scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: path.join(__dirname, ".."),
    env: process.env,
    stdio: "inherit",
  });
  return (result.status ?? 1) === 0;
}

function buildSecurityReport(reportJson) {
  const issues = (reportJson.issues ?? []).filter(
    (i) => i.type === "VULNERABILITY" && (i.status === "OPEN" || i.status === "CONFIRMED"),
  );
  issues.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const bySeverity = { BLOCKER: [], CRITICAL: [], MAJOR: [], MINOR: [], INFO: [] };
  for (const issue of issues) {
    (bySeverity[issue.severity] ?? bySeverity.INFO).push(issue);
  }

  const lines = [];
  lines.push("# Sonar Security Report");
  lines.push("");
  lines.push(`- Generated: ${reportJson.generated_at}`);
  lines.push(`- Project: ${reportJson.project_key}`);
  lines.push(`- Scope: ${reportJson.scope}`);
  lines.push(`- Open security issues: **${issues.length}**`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Severity | Count |");
  lines.push("|----------|-------|");
  for (const sev of ["BLOCKER", "CRITICAL", "MAJOR", "MINOR"]) {
    lines.push(`| ${sev} | ${bySeverity[sev].length} |`);
  }
  lines.push("");
  lines.push("## Remediation batches");
  lines.push("");
  lines.push("### Batch 1 — BLOCKER (fix first)");
  lines.push("");
  for (const issue of bySeverity.BLOCKER) {
    const where = `${issue.path}${issue.line ? `:${issue.line}` : ""}`;
    lines.push(`- \`${where}\` · ${issue.rule} · ${issue.message}`);
  }
  lines.push("");
  lines.push("### Batch 2 — CRITICAL");
  lines.push("");
  for (const issue of bySeverity.CRITICAL.slice(0, 15)) {
    const where = `${issue.path}${issue.line ? `:${issue.line}` : ""}`;
    lines.push(`- \`${where}\` · ${issue.rule}`);
  }
  if (bySeverity.CRITICAL.length > 15) {
    lines.push(`- … og ${bySeverity.CRITICAL.length - 15} flere`);
  }
  lines.push("");
  lines.push("### Batch 3 — MAJOR (triage demo/test false positives)");
  lines.push("");
  lines.push(`- ${bySeverity.MAJOR.length} issues — mange er demo passwords og test fixtures`);
  lines.push("");
  lines.push("## Agent handoff");
  lines.push("");
  lines.push("1. Læs `.cursor/skills/stardesk-sonar-agent/SKILL.md`");
  lines.push("2. Fix Batch 1, kør pytest + deliverable gate");
  lines.push("3. Opdater canvas queue (`fixStatus`) og kør `npm run sonar:pipeline` igen");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const scope = process.argv[2] ?? "all";
  const args = scope === "all" ? [] : [scope];

  if (!process.env.SONAR_TOKEN || !process.env.SONAR_PROJECT_KEY) {
    console.error("SONAR_TOKEN and SONAR_PROJECT_KEY required.");
    process.exit(1);
  }

  console.log("=== Sonar Security Pipeline ===\n");

  if (!runNode("run-sonar-agent.mjs", args)) {
    process.exit(1);
  }
  if (!runNode("sync-sonar-to-canvas.mjs")) {
    process.exit(1);
  }

  const reportJsonPath = path.join(REPORT_DIR, "sonar-agent-latest.json");
  const reportJson = JSON.parse(fs.readFileSync(reportJsonPath, "utf8"));
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(SECURITY_REPORT, buildSecurityReport(reportJson), "utf8");
  console.log(`\nWrote ${SECURITY_REPORT}`);
  console.log("\nPipeline complete. Open stardesk-sonar-agent.canvas.tsx beside chat.");
}

main();
