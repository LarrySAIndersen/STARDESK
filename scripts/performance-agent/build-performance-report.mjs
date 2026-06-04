#!/usr/bin/env node
/**
 * Merge JMeter + Playwright reports into performance-agent-latest.{json,md}
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLAN_ITEMS, DEFAULT_THRESHOLDS } from "./performance-plan.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORT_DIR = path.join(REPO_ROOT, "reports");
const JMETER_JSON = path.join(REPORT_DIR, "performance-jmeter-latest.json");
const PLAYWRIGHT_JSON = path.join(REPORT_DIR, "performance-playwright-latest.json");
const LOAD_TEST_JSON = path.join(REPORT_DIR, "performance-load-test-latest.json");
const EVIDENCE_MANIFEST = path.join(REPORT_DIR, "performance-evidence-manifest.json");
const OUT_JSON = path.join(REPORT_DIR, "performance-agent-latest.json");
const OUT_MD = path.join(REPORT_DIR, "performance-agent-latest.md");

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function mapPlanCoverage(jmeter, playwright) {
  return PLAN_ITEMS.map((item) => {
    let status = "not_measured";
    let evidence = null;

    if (item.measurable) {
      if (item.agent === "jmeter" && jmeter?.endpointStats) {
        const related = Object.entries(jmeter.endpointStats).filter(([label]) =>
          labelMatchesPlan(label, item.n),
        );
        if (related.length > 0) {
          status = related.some(([, s]) => s.p95 > (DEFAULT_THRESHOLDS.api[related[0][0]] ?? 2000))
            ? "breach"
            : "ok";
          evidence = related.map(([label, s]) => `${label} p95=${s.p95}ms`).join("; ");
        }
      } else if (item.agent === "playwright" && playwright?.scenarioStats) {
        const related = Object.entries(playwright.scenarioStats).filter(([, s]) =>
          s.planItems?.includes(item.n),
        );
        if (related.length > 0) {
          status = related.some(([, s]) => s.wallClockMs.p95 > s.thresholdMs) ? "breach" : "ok";
          evidence = related.map(([id, s]) => `${id} p95=${s.wallClockMs.p95}ms`).join("; ");
        }
      } else if (item.agent === "both") {
        status = "partial";
      }
    }

    return { ...item, status, evidence };
  });
}

function labelMatchesPlan(label, planN) {
  const map = {
    1: ["tickets-list", "ticket-detail", "kanban-board-detail"],
    5: ["ticket-detail"],
    6: ["categories"],
    13: ["tickets-list"],
    14: ["tickets-list"],
    25: ["kanban-boards", "kanban-board-detail"],
    31: ["dashboard"],
    50: ["health", "tickets-list"],
  };
  return (map[planN] ?? []).some((l) => label.includes(l));
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# STARDESK Performance Agent Report");
  lines.push("");
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Swarm pass: **${report.pass ? "YES" : "NO"}**`);
  lines.push(`- Constitution: \`STARDESK-performance-50.md\` (50-punkts plan)`);
  lines.push("");

  if (report.jmeter) {
    lines.push("## JMeter (API load)");
    lines.push("");
    lines.push(`- Target: ${report.jmeter.target}`);
    lines.push(`- Requests: ${report.jmeter.totalRequests}, errors: ${report.jmeter.totalErrors}`);
    lines.push(
      `- Latency p95: ${report.jmeter.latencyMs?.p95 ?? "n/a"} ms`,
    );
    lines.push(`- Pass: ${report.jmeter.pass ? "yes" : "no"}`);
    lines.push("");
    if (report.jmeter.endpointStats) {
      lines.push("| Endpoint | Count | p95 (ms) | Errors |");
      lines.push("|----------|-------|----------|--------|");
      for (const [label, stats] of Object.entries(report.jmeter.endpointStats)) {
        lines.push(`| ${label} | ${stats.count} | ${stats.p95} | ${stats.errors} |`);
      }
      lines.push("");
    }
  }

  if (report.playwright) {
    lines.push("## Playwright (UI perf)");
    lines.push("");
    lines.push(`- Target: ${report.playwright.target}`);
    lines.push(`- Pass: ${report.playwright.pass ? "yes" : "no"}`);
    lines.push("");
    if (report.playwright.scenarioStats) {
      lines.push("| Scenario | Wall p95 (ms) | LCP p95 (ms) | Threshold |");
      lines.push("|----------|---------------|--------------|-----------|");
      for (const [id, stats] of Object.entries(report.playwright.scenarioStats)) {
        lines.push(
          `| ${id} | ${stats.wallClockMs.p95} | ${stats.lcpMs.p95} | ${stats.thresholdMs} |`,
        );
      }
      lines.push("");
    }
  }

  if (report.loadTest) {
    lines.push("## Node load-test");
    lines.push("");
    lines.push(`- Scenario: ${report.loadTest.scenario}`);
    lines.push(`- Requests: ${report.loadTest.totalRequests}, errors: ${report.loadTest.totalErrors}`);
    lines.push(`- Latency p95: ${report.loadTest.latencyMs?.p95 ?? "n/a"} ms`);
    lines.push(`- Pass: ${report.loadTest.thresholdBreaches?.length === 0 ? "yes" : "no"}`);
    lines.push("");
  }

  lines.push("## Plan coverage (50 punkter)");
  lines.push("");
  lines.push("| # | Tier | Punkt | Målbar | Status | Evidence |");
  lines.push("|---|------|-------|--------|--------|----------|");
  for (const item of report.planCoverage) {
    lines.push(
      `| ${item.n} | ${item.tier} | ${item.title} | ${item.measurable ? "ja" : "nej"} | ${item.status} | ${item.evidence ?? "—"} |`,
    );
  }
  lines.push("");

  const breaches = [
    ...(report.jmeter?.thresholdBreaches ?? []),
    ...(report.playwright?.thresholdBreaches ?? []),
  ];
  if (breaches.length > 0) {
    lines.push("## Threshold breaches");
    lines.push("");
    for (const b of breaches) {
      lines.push(`- ${b}`);
    }
    lines.push("");
  }

  const manifest = readJson(EVIDENCE_MANIFEST);
  if (manifest?.files?.length) {
    lines.push("## Evidence & recordings");
    lines.push("");
    lines.push(`See full bundle: \`reports/performance-evidence-latest.md\``);
    lines.push("");
    lines.push("| Test type | Artifact | Size |");
    lines.push("|-----------|----------|------|");
    for (const file of manifest.files) {
      if (!file.exists || file.isDirectory) continue;
      const sizeKb = file.sizeBytes != null ? `${(file.sizeBytes / 1024).toFixed(1)} KB` : "—";
      lines.push(`| ${file.testType} | \`${file.path}\` | ${sizeKb} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function buildPerformanceReport() {
  const jmeter = readJson(JMETER_JSON);
  const playwright = readJson(PLAYWRIGHT_JSON);
  const loadTest = readJson(LOAD_TEST_JSON);

  if (!jmeter && !playwright && !loadTest) {
    throw new Error(
      "No agent reports found. Run npm run perf:agent or load-test first.",
    );
  }

  const planCoverage = mapPlanCoverage(jmeter, playwright);
  const pass =
    (jmeter?.pass ?? true) &&
    (playwright?.pass ?? true) &&
    (loadTest?.thresholdBreaches?.length ?? 0) === 0 &&
    planCoverage.filter((p) => p.status === "breach").length === 0;

  const report = {
    generatedAt: new Date().toISOString(),
    constitution: "STARDESK-performance-50.md",
    pass,
    jmeter,
    playwright,
    loadTest,
    planCoverage,
    summary: {
      measurableItems: planCoverage.filter((p) => p.measurable).length,
      measuredOk: planCoverage.filter((p) => p.status === "ok").length,
      breaches: planCoverage.filter((p) => p.status === "breach").length,
    },
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(OUT_MD, buildMarkdown(report), "utf8");

  return { report, outJson: OUT_JSON, outMd: OUT_MD };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const { outJson, outMd, report } = buildPerformanceReport();
  console.log(`Merged report: ${outJson}`);
  console.log(`Markdown: ${outMd}`);
  console.log(`Pass: ${report.pass}`);
  process.exit(report.pass ? 0 : 1);
}
