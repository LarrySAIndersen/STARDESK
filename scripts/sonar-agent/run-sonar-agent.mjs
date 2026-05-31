#!/usr/bin/env node
/**
 * SonarQube agent for STARDESK.
 *
 * Pulls issues from Sonar API and writes:
 * - reports/sonar-agent-latest.json
 * - reports/sonar-agent-latest.md
 *
 * Usage:
 *   npm run sonar:agent
 *   npm run sonar:agent:api
 *   node ./sonar-agent/run-sonar-agent.mjs web
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSonarEnv } from "./load-sonar-env.mjs";

loadSonarEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORT_DIR = path.join(REPO_ROOT, "reports");
const REPORT_JSON = path.join(REPORT_DIR, "sonar-agent-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "sonar-agent-latest.md");

const SCOPE_PATH_PREFIX = {
  api: "apps/api/",
  web: "apps/web/",
  all: "",
};

const TYPE_WEIGHT = {
  VULNERABILITY: 120,
  BUG: 100,
  CODE_SMELL: 60,
};

const SEVERITY_WEIGHT = {
  BLOCKER: 100,
  CRITICAL: 80,
  MAJOR: 50,
  MINOR: 20,
  INFO: 5,
};

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

function normalizeScope(raw) {
  const value = String(raw ?? "all").toLowerCase();
  if (value === "api" || value === "web" || value === "all") return value;
  return "all";
}

function scoreIssue(issue) {
  const severity = SEVERITY_WEIGHT[issue.severity] ?? 0;
  const type = TYPE_WEIGHT[issue.type] ?? 0;
  const securityHot = issue.tags?.includes("cwe") || issue.tags?.includes("owasp");
  return severity + type + (securityHot ? 15 : 0);
}

function shortenComponent(componentKey, projectKey) {
  const prefix = `${projectKey}:`;
  if (componentKey?.startsWith(prefix)) return componentKey.slice(prefix.length);
  return componentKey ?? "";
}

async function sonarGet(baseUrl, token, endpoint, params) {
  const url = new URL(endpoint, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  const auth = Buffer.from(`${token}:`).toString("base64");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Sonar API ${response.status} ${response.statusText}: ${body.slice(0, 300)}`);
  }
  return response.json();
}

async function fetchIssues(baseUrl, token, projectKey, branch, pullRequest, onlyNewCode) {
  const all = [];
  const pageSize = 500;
  let page = 1;
  let total = 0;

  do {
    const payload = await sonarGet(baseUrl, token, "/api/issues/search", {
      componentKeys: projectKey,
      branch,
      pullRequest,
      inNewCodePeriod: onlyNewCode ? "true" : undefined,
      ps: pageSize,
      p: page,
      additionalFields: "_all",
    });
    const issues = payload.issues ?? [];
    total = payload.total ?? issues.length;
    all.push(...issues);
    page += 1;
    if (!issues.length) break;
  } while (all.length < total);

  return all;
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# Sonar Agent Report");
  lines.push("");
  lines.push(`- Generated: ${report.generated_at}`);
  lines.push(`- Scope: ${report.scope}`);
  lines.push(`- Project: ${report.project_key}`);
  lines.push(`- Total issues: ${report.summary.total}`);
  lines.push(`- Vulnerabilities: ${report.summary.vulnerabilities}`);
  lines.push(`- Bugs: ${report.summary.bugs}`);
  lines.push(`- Code smells: ${report.summary.code_smells}`);
  lines.push("");
  lines.push("## Top Priorities");
  lines.push("");
  if (report.top_issues.length === 0) {
    lines.push("- No matching issues found.");
  } else {
    for (const issue of report.top_issues) {
      const where = `${issue.path}${issue.line ? `:${issue.line}` : ""}`;
      lines.push(
        `- [${issue.severity}] ${issue.type} · ${where} · ${issue.rule} · ${issue.message}`,
      );
    }
  }
  lines.push("");
  lines.push("## File Hotspots");
  lines.push("");
  for (const row of report.hotspots.slice(0, 20)) {
    lines.push(`- ${row.path}: ${row.count} issues (score ${row.score})`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function summarize(issues) {
  const summary = {
    total: issues.length,
    vulnerabilities: 0,
    bugs: 0,
    code_smells: 0,
    by_severity: { BLOCKER: 0, CRITICAL: 0, MAJOR: 0, MINOR: 0, INFO: 0 },
  };
  for (const issue of issues) {
    if (issue.type === "VULNERABILITY") summary.vulnerabilities += 1;
    else if (issue.type === "BUG") summary.bugs += 1;
    else if (issue.type === "CODE_SMELL") summary.code_smells += 1;
    if (summary.by_severity[issue.severity] != null) {
      summary.by_severity[issue.severity] += 1;
    }
  }
  return summary;
}

function createReport(rawIssues, opts) {
  const scoped = rawIssues
    .map((issue) => {
      const pathValue = shortenComponent(issue.component, opts.projectKey);
      return {
        key: issue.key,
        rule: issue.rule,
        severity: issue.severity,
        type: issue.type,
        status: issue.status,
        resolution: issue.resolution ?? null,
        message: issue.message,
        line: issue.line ?? null,
        path: pathValue,
        effort: issue.effort ?? null,
        tags: issue.tags ?? [],
        score: scoreIssue(issue),
      };
    })
    .filter((issue) => {
      if (!opts.prefix) return true;
      return issue.path.startsWith(opts.prefix);
    });

  scoped.sort((a, b) => b.score - a.score);

  const hotspotMap = new Map();
  for (const issue of scoped) {
    const bucket = hotspotMap.get(issue.path) ?? { path: issue.path, count: 0, score: 0 };
    bucket.count += 1;
    bucket.score += issue.score;
    hotspotMap.set(issue.path, bucket);
  }
  const hotspots = [...hotspotMap.values()].sort((a, b) => b.score - a.score);

  return {
    generated_at: new Date().toISOString(),
    source: "sonarqube",
    scope: opts.scope,
    project_key: opts.projectKey,
    new_code_only: opts.newCodeOnly,
    branch: opts.branch ?? null,
    pull_request: opts.pullRequest ?? null,
    summary: summarize(scoped),
    top_issues: scoped.slice(0, 40),
    hotspots,
    issues: scoped,
  };
}

async function main() {
  const scope = normalizeScope(process.argv[2] ?? "all");
  const prefix = SCOPE_PATH_PREFIX[scope];
  const baseUrl = requiredEnv("SONAR_HOST_URL");
  const token = requiredEnv("SONAR_TOKEN");
  const projectKey = requiredEnv("SONAR_PROJECT_KEY");
  const branch = process.env.SONAR_BRANCH;
  const pullRequest = process.env.SONAR_PULL_REQUEST;
  const newCodeOnly = process.env.SONAR_NEW_CODE_ONLY !== "0";

  const rawIssues = await fetchIssues(baseUrl, token, projectKey, branch, pullRequest, newCodeOnly);
  const report = createReport(rawIssues, {
    scope,
    prefix,
    projectKey,
    branch,
    pullRequest,
    newCodeOnly,
  });

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(REPORT_MD, buildMarkdown(report), "utf8");

  console.log(`Wrote ${REPORT_JSON}`);
  console.log(`Wrote ${REPORT_MD}`);
  console.log(
    `Summary: ${report.summary.total} total · ${report.summary.vulnerabilities} vulnerabilities · ` +
      `${report.summary.bugs} bugs · ${report.summary.code_smells} code smells`,
  );
}

main().catch((error) => {
  console.error(`Sonar agent failed: ${error.message}`);
  process.exit(1);
});
