#!/usr/bin/env node
/**
 * Parse pytest coverage.json → reports/coverage-agent-latest.{json,md}
 *
 *   node run-coverage-agent.mjs [--skip-tests]
 *
 * Env: COVERAGE_MIN (optional) — fail exit 1 if line rate below threshold
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCommandPath } from "../lib/script-security.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const API_DIR = path.join(REPO_ROOT, "apps/api");
const COVERAGE_JSON = path.join(API_DIR, "coverage.json");
const REPORT_DIR = path.join(REPO_ROOT, "reports");
const REPORT_JSON = path.join(REPORT_DIR, "coverage-agent-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "coverage-agent-latest.md");

const STARTUP_EXEMPT = new Set(["db_schema_sync.py", "db_alembic.py"]);
const AREA_DEFS = [
  { id: "services", label: "Services", match: /[/\\]services[/\\]/ },
  { id: "routers", label: "Routers", match: /[/\\]routers[/\\]/ },
  { id: "models", label: "Models", match: /[/\\]models[/\\]/ },
  { id: "schemas", label: "Schemas", match: /[/\\]schemas[/\\]/ },
  { id: "core", label: "Core", match: /[/\\]core[/\\]/ },
];

function classifyArea(repoRelativePath) {
  for (const area of AREA_DEFS) {
    if (area.match.test(repoRelativePath)) {
      return area.id;
    }
  }
  return "other";
}

function toRepoPath(absOrRel) {
  const normalized = absOrRel.replace(/\\/g, "/");
  const idx = normalized.indexOf("apps/api/src/star_itsm_api/");
  if (idx >= 0) {
    return normalized.slice(idx);
  }
  if (normalized.startsWith("src/star_itsm_api/")) {
    return `apps/api/${normalized}`;
  }
  return normalized;
}

function runPytestCoverage() {
  const uvPath = resolveCommandPath("uv");
  const args = [
    "run",
    "pytest",
    "-q",
    "--cov=star_itsm_api",
    "--cov-report=json:coverage.json",
    "--cov-report=term",
    "--cov-fail-under=85",
  ];
  const result = uvPath
    ? spawnSync(uvPath, args, { cwd: API_DIR, env: process.env, stdio: "inherit", shell: false })
    : spawnSync("pytest", args.slice(1), {
        cwd: API_DIR,
        env: process.env,
        stdio: "inherit",
        shell: false,
      });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function pct(numerator, denominator) {
  if (!denominator) return 100;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function parseCoverageJson() {
  if (!fs.existsSync(COVERAGE_JSON)) {
    console.error(`Missing ${COVERAGE_JSON}. Run pytest with --cov-report=json first.`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(COVERAGE_JSON, "utf8"));
  const files = [];
  const areaBuckets = Object.fromEntries(AREA_DEFS.map((a) => [a.id, { ...a, files: 0, statements: 0, covered_lines: 0 }]));
  areaBuckets.other = { id: "other", label: "Other API", files: 0, statements: 0, covered_lines: 0 };

  let totalStatements = 0;
  let totalCovered = 0;
  let totalMissing = 0;
  let totalBranches = 0;
  let totalCoveredBranches = 0;
  let filesZero = 0;
  let filesBelow50 = 0;
  let filesAtLeast80 = 0;

  for (const [filePath, entry] of Object.entries(raw.files ?? {})) {
    if (filePath.includes("/tests/") || filePath.includes("\\tests\\")) continue;
    const summary = entry.summary ?? {};
    const statements = summary.num_statements ?? 0;
    const covered = summary.covered_lines ?? 0;
    const missing = summary.missing_lines ?? 0;
    const branches = summary.num_branches ?? 0;
    const coveredBranches = summary.covered_branches ?? 0;
    const lineRate = summary.percent_covered ?? pct(covered, statements);
    const branchRate = pct(coveredBranches, branches);

    const repoPath = toRepoPath(filePath);
    const baseName = path.basename(repoPath);
    const areaId = classifyArea(repoPath);

    totalStatements += statements;
    totalCovered += covered;
    totalMissing += missing;
    totalBranches += branches;
    totalCoveredBranches += coveredBranches;

    const bucket = areaBuckets[areaId];
    bucket.files += 1;
    bucket.statements += statements;
    bucket.covered_lines += covered;

    if (statements > 0 && covered === 0) filesZero += 1;
    if (lineRate < 50) filesBelow50 += 1;
    if (lineRate >= 80) filesAtLeast80 += 1;

    files.push({
      path: repoPath,
      statements,
      covered_lines: covered,
      missing_lines: missing,
      line_rate: lineRate,
      branch_rate: branchRate,
      area: areaId,
      exempt: STARTUP_EXEMPT.has(baseName),
    });
  }

  const lineRate = pct(totalCovered, totalStatements);
  const branchRate = pct(totalCoveredBranches, totalBranches);

  const areas = [...AREA_DEFS.map((a) => a.id), "other"].map((id) => {
    const b = areaBuckets[id];
    return {
      id: b.id,
      label: b.label,
      files: b.files,
      statements: b.statements,
      covered_lines: b.covered_lines,
      line_rate: pct(b.covered_lines, b.statements),
    };
  });

  const priorities = files
    .filter((f) => f.statements >= 20 && !f.exempt)
    .sort((a, b) => a.line_rate - b.line_rate || b.statements - a.statements)
    .slice(0, 25)
    .map(({ path: p, statements, covered_lines, line_rate, branch_rate }) => ({
      path: p,
      statements,
      covered_lines,
      line_rate,
      branch_rate,
    }));

  return {
    generated_at: new Date().toISOString(),
    summary: {
      line_rate: lineRate,
      branch_rate: branchRate,
      statements: totalStatements,
      covered_lines: totalCovered,
      missing_lines: totalMissing,
      branches: totalBranches,
      covered_branches: totalCoveredBranches,
      files_total: files.length,
      files_zero_coverage: filesZero,
      files_below_50: filesBelow50,
      files_at_least_80: filesAtLeast80,
      tests_passed: raw.totals?.num_statements != null,
    },
    areas,
    priorities,
    files: files.sort((a, b) => a.line_rate - b.line_rate),
  };
}

function buildMarkdown(report) {
  const s = report.summary;
  const lines = [];
  lines.push("# Coverage Agent Report");
  lines.push("");
  lines.push(`- Generated: ${report.generated_at}`);
  lines.push(`- Line coverage: **${s.line_rate}%** (${s.covered_lines} / ${s.statements})`);
  lines.push(`- Branch coverage: **${s.branch_rate}%**`);
  lines.push(`- Files: ${s.files_total} total · ${s.files_zero_coverage} at 0% · ${s.files_below_50} below 50% · ${s.files_at_least_80} at ≥80%`);
  lines.push("");
  lines.push("## By area");
  lines.push("");
  lines.push("| Area | Line % | Statements |");
  lines.push("|------|--------|------------|");
  for (const area of report.areas) {
    lines.push(`| ${area.label} | ${area.line_rate}% | ${area.statements} |`);
  }
  lines.push("");
  lines.push("## Priority backlog (≥20 statements, lowest line %)");
  lines.push("");
  for (const item of report.priorities.slice(0, 15)) {
    lines.push(`- \`${item.path}\` — ${item.line_rate}% (${item.covered_lines}/${item.statements})`);
  }
  lines.push("");
  lines.push("## CI thresholds");
  lines.push("");
  lines.push("- pytest `--cov-fail-under=85` (API overall)");
  lines.push("- SonarCloud quality gate: Coverage on New Code ≥ 80%");
  lines.push("- Web excluded from Sonar coverage until Vitest covers meaningful share");
  return lines.join("\n");
}

function main() {
  const skipTests = process.argv.includes("--skip-tests");
  if (!skipTests) {
    console.log("=== Coverage agent: pytest ===");
    runPytestCoverage();
  }

  console.log("=== Coverage agent: parse ===");
  const report = parseCoverageJson();
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(REPORT_MD, buildMarkdown(report), "utf8");

  console.log(`Line: ${report.summary.line_rate}% · Branch: ${report.summary.branch_rate}%`);
  console.log(`Report: ${path.relative(REPO_ROOT, REPORT_JSON)}`);

  const min = Number(process.env.COVERAGE_MIN);
  if (Number.isFinite(min) && report.summary.line_rate < min) {
    console.error(`Coverage ${report.summary.line_rate}% below COVERAGE_MIN=${min}`);
    process.exit(1);
  }

  process.exit(0);
}

main();
