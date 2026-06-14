#!/usr/bin/env node
/**
 * Deploy Check Agent pipeline — poll Vercel, run hello-world gates, classify failures, feedback loop.
 *
 * Usage:
 *   node run-deploy-check.mjs [staging|production] [--full] [--skip-vercel] [--skip-ui]
 *
 * Reports:
 *   reports/deploy-check-latest.json
 *   reports/deploy-check-latest.md
 *   reports/deploy-check-agent-prompt.md (on failure)
 *
 * Env: VERCEL_TOKEN, VERCEL_PROTECTION_BYPASS, TEST_USER_PASSWORD, DATABASE_URL (for local only)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyFailure } from "./classify-failure.mjs";
import {
  readKnowledge,
  writeKnowledge,
  appendLog,
  recordScan,
  LATEST_JSON,
  LATEST_MD,
} from "./knowledge-io.mjs";
import { resolveTarget } from "./targets.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const SCRIPTS_DIR = path.join(REPO_ROOT, "scripts");

const args = process.argv.slice(2);
const targetName = args.find((a) => !a.startsWith("-")) ?? "staging";
const full = args.includes("--full");
const skipVercel = args.includes("--skip-vercel");
const skipUi = args.includes("--skip-ui");

function gitCommit() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : null;
}

function runNode(script, scriptArgs = [], env = {}) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script), ...scriptArgs], {
    cwd: SCRIPTS_DIR,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return {
    ok: (result.status ?? 1) === 0,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function runBash(script, env = {}) {
  const result = spawnSync("bash", [path.join(SCRIPTS_DIR, script)], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return {
    ok: (result.status ?? 1) === 0,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/**
 * @param {string} checkId
 * @param {string} message
 * @param {string} detail
 */
function makeFailure(checkId, message, detail) {
  const combined = `${message}\n${detail}`;
  return {
    checkId,
    message,
    detail: detail.slice(0, 4000),
    classification: classifyFailure(combined, [checkId]),
  };
}

async function main() {
  const target = resolveTarget(targetName);
  const at = new Date().toISOString();
  const commit = gitCommit();
  const failures = [];
  const checks = [];

  console.log("==============================================");
  console.log(` STARDESK Deploy Check — ${target.key}`);
  console.log(` API: ${target.apiUrl}`);
  console.log(` Web: ${target.webUrl}`);
  console.log(` Suite: v${readKnowledge().checkSuiteVersion ?? 1}`);
  console.log("==============================================\n");

  // 1) Vercel deployment status
  if (!skipVercel) {
    const poll = runNode("deploy-check/poll-vercel-deployment.mjs", [target.key, "--json"]);
    let pollData = null;
    try {
      pollData = JSON.parse(poll.stdout);
    } catch {
      pollData = { skipped: true, reason: poll.stderr || poll.stdout };
    }
    checks.push({ id: "vercel_status", ok: poll.ok || pollData?.skipped, detail: pollData });
    if (!poll.ok && !pollData?.skipped) {
      const errMsg = pollData?.deployments
        ?.map((d) => `${d.project}:${d.state} ${d.error ?? ""}`)
        .join("; ");
      failures.push(makeFailure("vercel_status", "Vercel deployment not ready", errMsg ?? poll.stderr));
    }
  }

  const gateEnv = {
    STARDESK_API_URL: target.apiUrl.replace(/\/$/, ""),
    GATE_REQUIRE_NON_PROD: target.requireNonProd ? "1" : "0",
  };

  // 2) API hello-world gate
  const apiGate = runBash("hello-world-gate-api.sh", gateEnv);
  checks.push({ id: "api_health", ok: apiGate.ok, detail: apiGate.stdout.slice(-500) });
  if (!apiGate.ok) {
    const detail = `${apiGate.stderr}\n${apiGate.stdout}`;
    failures.push(makeFailure("api_health", "API hello-world gate failed", detail));
  }

  // 3) UI gate (optional / --full)
  if (full && !skipUi && target.requireNonProd) {
    const uiGate = runNode("hello-world-gate.mjs", [], {
      STARDESK_WEB_URL: target.webUrl.replace(/\/$/, ""),
    });
    checks.push({ id: "ui_gate", ok: uiGate.ok, detail: uiGate.stdout.slice(-500) });
    if (!uiGate.ok) {
      failures.push(makeFailure("ui_gate", "UI hello-world gate failed", `${uiGate.stderr}\n${uiGate.stdout}`));
    }
  }

  // 4) Production uses dedicated prod gate when target is production
  if (target.key === "production" && full) {
    const prodGate = runNode("hello-world-gate-prod.mjs", []);
    checks.push({ id: "prod_gate", ok: prodGate.ok, detail: prodGate.stdout.slice(-500) });
    if (!prodGate.ok) {
      failures.push(makeFailure("prod_gate", "Production hello-world gate failed", `${prodGate.stderr}\n${prodGate.stdout}`));
    }
  }

  const passed = failures.length === 0;
  const failureIds = [
    ...new Set(failures.flatMap((f) => (f.classification ?? []).map((c) => c.id))),
  ];

  const report = {
    at,
    target: target.key,
    branch: target.branch,
    commit,
    passed,
    checks,
    failures,
    failureIds,
    checkSuiteVersion: readKnowledge().checkSuiteVersion ?? 1,
    urls: { api: target.apiUrl, web: target.webUrl },
  };

  fs.mkdirSync(path.dirname(LATEST_JSON), { recursive: true });
  fs.writeFileSync(LATEST_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const md = buildMarkdown(report);
  fs.writeFileSync(LATEST_MD, md, "utf8");

  const knowledge = readKnowledge();
  recordScan(knowledge, { at, target: target.key, passed, failureIds, commit });
  appendLog(
    knowledge,
    `scan target=${target.key} passed=${passed} failures=${failureIds.join(",") || "-"}`,
  );
  writeKnowledge(knowledge);

  runNode("deploy-check/emit-agent-prompt.mjs");

  console.log(md);
  process.exit(passed ? 0 : 1);
}

/**
 * @param {object} report
 */
function buildMarkdown(report) {
  const lines = [
    "# Deploy Check Report",
    "",
    `| Field | Value |`,
    `|-------|-------|`,
    `| At | ${report.at} |`,
    `| Target | ${report.target} |`,
    `| Commit | ${report.commit ?? "—"} |`,
    `| Result | **${report.passed ? "PASSED" : "FAILED"}** |`,
    `| Check suite | v${report.checkSuiteVersion} |`,
    "",
    "## URLs",
    "",
    `- API: ${report.urls.api}`,
    `- Web: ${report.urls.web}`,
    "",
    "## Checks",
    "",
    "| Check | OK |",
    "|-------|-----|",
  ];
  for (const c of report.checks) {
    lines.push(`| ${c.id} | ${c.ok ? "yes" : "no"} |`);
  }
  if (report.failures?.length) {
    lines.push("", "## Failures", "");
    for (const f of report.failures) {
      lines.push(`### ${f.checkId}: ${f.message}`);
      for (const c of f.classification ?? []) {
        lines.push(`- **${c.id}**: ${c.diagnosis}`);
        lines.push(`  - Suggested: ${c.suggestedFix}`);
      }
      lines.push("");
    }
    lines.push("## Next steps", "");
    lines.push("1. Read `reports/deploy-check-agent-prompt.md`");
    lines.push("2. Fix → PR to staging → re-run pipeline");
    lines.push("3. `npm run deploy-check:result -- --pattern <id> --status fixed|failed --notes \"...\"`");
  }
  return `${lines.join("\n")}\n`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
