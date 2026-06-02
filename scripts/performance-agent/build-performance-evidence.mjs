#!/usr/bin/env node
/**
 * Bundle performance test artifacts into a manifest + markdown evidence report.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORT_DIR = path.join(REPO_ROOT, "reports");

const JMETER_JSON = path.join(REPORT_DIR, "performance-jmeter-latest.json");
const PLAYWRIGHT_JSON = path.join(REPORT_DIR, "performance-playwright-latest.json");
const LOAD_TEST_JSON = path.join(REPORT_DIR, "performance-load-test-latest.json");
const OUT_MD = path.join(REPORT_DIR, "performance-evidence-latest.md");
const OUT_MANIFEST = path.join(REPORT_DIR, "performance-evidence-manifest.json");

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function statEntry(relPath, testType) {
  const absPath = path.join(REPO_ROOT, relPath.replace(/\//g, path.sep));
  if (!fs.existsSync(absPath)) {
    return { path: relPath, testType, exists: false };
  }
  const st = fs.statSync(absPath);
  return {
    path: relPath,
    testType,
    exists: true,
    sizeBytes: st.size,
    mtime: st.mtime.toISOString(),
    isDirectory: st.isDirectory(),
  };
}

function collectPathsFromReport(report, testType) {
  const paths = [];
  if (!report) return paths;

  const artifacts = report.artifacts ?? {};
  for (const key of ["videos", "traces", "screenshots", "htmlFiles"]) {
    const list = artifacts[key];
    if (Array.isArray(list)) {
      for (const p of list) paths.push({ path: p, testType, kind: key });
    }
  }

  for (const key of ["jtl", "htmlIndex", "htmlReportDir", "usersCsv", "stampedReport", "latestReport", "dir"]) {
    const p = artifacts[key];
    if (typeof p === "string" && p) {
      paths.push({ path: p, testType, kind: key });
    }
  }

  if (typeof report.jtlPath === "string") {
    paths.push({ path: report.jtlPath, testType, kind: "jtl" });
  }

  for (const run of report.runs ?? []) {
    if (run.screenshot) {
      paths.push({ path: run.screenshot, testType, kind: "screenshot" });
    }
  }

  return paths;
}

function uniquePaths(entries) {
  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    const key = entry.path;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

function formatBytes(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function summaryRow(label, report) {
  if (!report) return `| ${label} | — | — | missing |`;
  const pass = report.pass ?? report.thresholdBreaches?.length === 0;
  const target = report.target ?? report.baseUrl ?? "—";
  return `| ${label} | ${target} | ${pass ? "PASS" : "FAIL"} | ${report.generatedAt ?? report.finishedAt ?? report.startedAt ?? "—"} |`;
}

function buildMarkdown({ jmeter, playwright, loadTest, manifest }) {
  const lines = [];
  lines.push("# STARDESK Performance Evidence");
  lines.push("");
  lines.push(`Generated: ${manifest.generatedAt}`);
  lines.push(`Total artifact files: ${manifest.files.filter((f) => f.exists && !f.isDirectory).length}`);
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push("| Test type | Target | Result | Timestamp |");
  lines.push("|-----------|--------|--------|-----------|");
  lines.push(summaryRow("JMeter (API)", jmeter));
  lines.push(summaryRow("Playwright (UI)", playwright));
  lines.push(summaryRow("Node load-test", loadTest));
  lines.push("");

  if (playwright?.artifacts) {
    lines.push("## Playwright recordings");
    lines.push("");
    const { videos = [], traces = [], screenshots = [] } = playwright.artifacts;
    lines.push(`- Videos (${videos.length}):`);
    for (const v of videos) lines.push(`  - \`${v}\``);
    lines.push(`- Traces (${traces.length}):`);
    for (const t of traces) lines.push(`  - \`${t}\``);
    lines.push(`- Screenshots (${screenshots.length}):`);
    for (const s of screenshots) {
      lines.push(`  - \`${s}\``);
      lines.push(`  - ![${path.basename(s)}](../${s})`);
    }
    lines.push("");
  }

  if (jmeter?.artifacts) {
    lines.push("## JMeter artifacts");
    lines.push("");
    lines.push(`- JTL: \`${jmeter.artifacts.jtl ?? jmeter.jtlPath ?? "—"}\``);
    if (jmeter.artifacts.htmlIndex) {
      lines.push(`- HTML dashboard: \`${jmeter.artifacts.htmlIndex}\``);
    }
    lines.push(`- Report dir: \`${jmeter.artifacts.htmlReportDir ?? "—"}\``);
    const htmlCount = jmeter.artifacts.htmlFiles?.length ?? 0;
    lines.push(`- HTML files: ${htmlCount}`);
    lines.push("");
  }

  if (loadTest?.artifacts) {
    lines.push("## Node load-test reports");
    lines.push("");
    lines.push(`- Latest: \`${loadTest.artifacts.latestReport}\``);
    lines.push(`- Stamped: \`${loadTest.artifacts.stampedReport}\``);
    lines.push(`- Artifacts dir: \`${loadTest.artifacts.dir}\``);
    if (loadTest.scenario) {
      lines.push(`- Scenario: ${loadTest.scenario}, requests: ${loadTest.totalRequests ?? "—"}`);
    }
    lines.push("");
  }

  lines.push("## Full artifact manifest");
  lines.push("");
  lines.push("| Test type | Path | Size | Modified |");
  lines.push("|-----------|------|------|----------|");
  for (const file of manifest.files) {
    if (!file.exists || file.isDirectory) continue;
    lines.push(
      `| ${file.testType} | \`${file.path}\` | ${formatBytes(file.sizeBytes)} | ${file.mtime ?? "—"} |`,
    );
  }
  lines.push("");

  return lines.join("\n");
}

export function buildPerformanceEvidence() {
  const jmeter = readJson(JMETER_JSON);
  const playwright = readJson(PLAYWRIGHT_JSON);
  const loadTest = readJson(LOAD_TEST_JSON);

  const pathEntries = uniquePaths([
    ...collectPathsFromReport(jmeter, "jmeter"),
    ...collectPathsFromReport(playwright, "playwright"),
    ...collectPathsFromReport(loadTest, "load-test"),
  ]);

  const files = pathEntries.map(({ path: relPath, testType }) => statEntry(relPath, testType));

  const manifest = {
    generatedAt: new Date().toISOString(),
    sources: {
      jmeter: fs.existsSync(JMETER_JSON) ? "reports/performance-jmeter-latest.json" : null,
      playwright: fs.existsSync(PLAYWRIGHT_JSON) ? "reports/performance-playwright-latest.json" : null,
      loadTest: fs.existsSync(LOAD_TEST_JSON) ? "reports/performance-load-test-latest.json" : null,
    },
    files,
    counts: {
      jmeter: files.filter((f) => f.testType === "jmeter" && f.exists).length,
      playwright: files.filter((f) => f.testType === "playwright" && f.exists).length,
      loadTest: files.filter((f) => f.testType === "load-test" && f.exists).length,
    },
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(OUT_MANIFEST, JSON.stringify(manifest, null, 2), "utf8");
  fs.writeFileSync(
    OUT_MD,
    buildMarkdown({ jmeter, playwright, loadTest, manifest }),
    "utf8",
  );

  return { manifest, outMd: OUT_MD, outManifest: OUT_MANIFEST };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const { outMd, outManifest, manifest } = buildPerformanceEvidence();
  console.log(`Evidence markdown: ${outMd}`);
  console.log(`Evidence manifest: ${outManifest}`);
  console.log(
    `Artifacts: jmeter=${manifest.counts.jmeter}, playwright=${manifest.counts.playwright}, load-test=${manifest.counts.loadTest}`,
  );
}
