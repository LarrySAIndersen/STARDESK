#!/usr/bin/env node
/**
 * STARDESK quality loop — Sonar review + destructive test review.
 * Intended for n8n Schedule Trigger or manual/CI runs.
 *
 *   node run-quality-loop.mjs
 *
 * Env:
 *   SONAR_* — see scripts/sonar-agent/.env.example
 *   ALLOW_DESTRUCTIVE=1 — required for any destructive k6/pytest
 *   QUALITY_LOOP_DESTRUCTIVE=smoke|full|off  (default smoke)
 *   QUALITY_LOOP_SONAR_SCOPES=api,web,all   (default api)
 *   BASE_URL — load-test target (default http://localhost:8000)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORT_DIR = path.join(REPO_ROOT, "reports");
const REPORT_JSON = path.join(REPORT_DIR, "quality-loop-latest.json");
const REPORT_MD = path.join(REPORT_DIR, "quality-loop-latest.md");
const AGENT_PROMPT_MD = path.join(REPORT_DIR, "quality-loop-agent-prompt.md");

const SKILL_DESTRUCTIVE = ".cursor/skills/stardesk-destructive-test-review/SKILL.md";
const SKILL_SONAR = ".cursor/skills/stardesk-sonar-review-loop/SKILL.md";

function runNode(scriptRel, args = [], label) {
  const scriptPath = path.join(__dirname, scriptRel);
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: path.join(__dirname, ".."),
    env: process.env,
    stdio: "inherit",
    shell: false,
  });
  return {
    ok: (result.status ?? 1) === 0,
    status: result.status ?? 1,
    error: result.error?.message ?? null,
  };
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function isLocalishUrl(url) {
  const u = String(url || "").toLowerCase();
  return (
    u.includes("localhost") ||
    u.includes("127.0.0.1") ||
    u.includes("preprod") ||
    u.includes(".local")
  );
}

function runSonarPhases() {
  const scopesRaw = process.env.QUALITY_LOOP_SONAR_SCOPES ?? "api";
  const scopes = scopesRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const results = [];

  if (!process.env.SONAR_TOKEN || !process.env.SONAR_PROJECT_KEY) {
    return {
      status: "skipped",
      reason: "SONAR_TOKEN or SONAR_PROJECT_KEY not set",
      scopes: [],
    };
  }

  let anyFailed = false;
  for (const scope of scopes) {
    const run = runNode("../sonar-agent/run-sonar-agent.mjs", [scope], `Sonar agent (${scope})`);
    results.push({ scope, ...run });
    if (!run.ok) anyFailed = true;
  }

  const report = readJsonIfExists(path.join(REPORT_DIR, "sonar-agent-latest.json"));
  return {
    status: anyFailed ? "failed" : "ok",
    scopes: results,
    report_summary: report?.summary ?? null,
    report_path: "reports/sonar-agent-latest.json",
  };
}

function runDestructivePhase() {
  const mode = (process.env.QUALITY_LOOP_DESTRUCTIVE ?? "smoke").toLowerCase();
  if (mode === "off") {
    return { status: "skipped", reason: "QUALITY_LOOP_DESTRUCTIVE=off" };
  }

  if (process.env.ALLOW_DESTRUCTIVE !== "1") {
    return {
      status: "skipped",
      reason: "Set ALLOW_DESTRUCTIVE=1 to run destructive scenarios",
    };
  }

  const baseUrl = process.env.BASE_URL ?? "http://localhost:8000";
  if (!isLocalishUrl(baseUrl) && process.env.QUALITY_LOOP_ALLOW_REMOTE !== "1") {
    return {
      status: "skipped",
      reason: `BASE_URL ${baseUrl} is not local/preprod — set QUALITY_LOOP_ALLOW_REMOTE=1 to override`,
    };
  }

  const scenarios = [];
  if (mode === "smoke") {
    scenarios.push(
      runNode("../load-test/run-k6-destructive.mjs", ["spike.js", "--smoke"], "k6 spike (smoke)"),
    );
  } else if (mode === "full") {
    scenarios.push(runNode("../load-test/run-destructive-agent.mjs", [], "Full destructive agent"));
  } else {
    return { status: "failed", reason: `Unknown QUALITY_LOOP_DESTRUCTIVE=${mode}` };
  }

  const anyFailed = scenarios.some((s) => !s.ok);
  const loadReport = readJsonIfExists(path.join(__dirname, "../load-test/reports/latest.json"));

  return {
    status: anyFailed ? "failed" : "ok",
    mode,
    base_url: baseUrl,
    scenarios,
    load_report_path: loadReport ? "scripts/load-test/reports/latest.json" : null,
    load_summary: loadReport ?? null,
  };
}

function buildAgentPrompts(sonar, destructive) {
  const destructiveBlock =
    destructive.status === "ok" || destructive.status === "failed"
      ? `# Destructive test review

Læs skill: \`${SKILL_DESTRUCTIVE}\`

Gennemgå seneste destructive-kørsel (mode: ${destructive.mode ?? "n/a"}, target: ${destructive.base_url ?? "n/a"}).
Rapporter: \`scripts/load-test/reports/latest.json\`, pytest output fra kørslen.

Acceptkriterier:
- Ingen uventet 5xx på kritiske flows under smoke
- Dokumentér fejl og foreslå fixes (max 3 P0)
`
      : `# Destructive test review

Destructive blev sprunget over: ${destructive.reason ?? destructive.status}
`;

  const sonarBlock =
    sonar.status === "ok"
      ? `# Sonar review

Læs skill: \`${SKILL_SONAR}\`

Gennemgå \`reports/sonar-agent-latest.md\` og \`reports/sonar-agent-latest.json\`.
Prioritér BLOCKER/CRITICAL vulnerabilities først; batch max 5 fixes ad gangen.

Summary: ${JSON.stringify(sonar.report_summary ?? {}, null, 2)}
`
      : `# Sonar review

Sonar blev sprunget over eller fejlede: ${sonar.reason ?? sonar.status}
`;

  const combined = `# STARDESK Quality Loop — agent review

Kør **begge** skills i rækkefølge (destructive først hvis data findes, derefter Sonar).

1. \`${SKILL_DESTRUCTIVE}\`
2. \`${SKILL_SONAR}\`

Opdater Work Board hvis der oprettes opfølgning-opgaver. Flyt ikke til Done uden bruger-godkendelse.

${destructiveBlock}

---

${sonarBlock}
`;

  return { destructive: destructiveBlock, sonar: sonarBlock, combined };
}

function buildMarkdown(payload) {
  const lines = [];
  lines.push("# STARDESK Quality Loop");
  lines.push("");
  lines.push(`- Generated: ${payload.generated_at}`);
  lines.push(`- Sonar: **${payload.sonar.status}**`);
  lines.push(`- Destructive: **${payload.destructive.status}**`);
  lines.push("");
  lines.push("## Skills (Cursor)");
  lines.push(`- \`${SKILL_DESTRUCTIVE}\``);
  lines.push(`- \`${SKILL_SONAR}\``);
  lines.push("");
  lines.push("## Agent prompt");
  lines.push("Kopiér indhold fra `reports/quality-loop-agent-prompt.md` til en ny agent-chat.");
  lines.push("");
  if (payload.sonar.report_summary) {
    lines.push("## Sonar summary");
    lines.push("```json");
    lines.push(JSON.stringify(payload.sonar.report_summary, null, 2));
    lines.push("```");
  }
  return `${lines.join("\n")}\n`;
}

function main() {
  const generatedAt = new Date().toISOString();
  const sonar = runSonarPhases();
  const destructive = runDestructivePhase();
  const agent_prompts = buildAgentPrompts(sonar, destructive);

  const payload = {
    generated_at: generatedAt,
    repo_root: REPO_ROOT,
    sonar,
    destructive,
    skills: [SKILL_DESTRUCTIVE, SKILL_SONAR],
    agent_prompts,
    overall_ok: sonar.status !== "failed" && destructive.status !== "failed",
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.writeFileSync(REPORT_MD, buildMarkdown(payload), "utf8");
  fs.writeFileSync(AGENT_PROMPT_MD, `${agent_prompts.combined}\n`, "utf8");

  console.log(`\nWrote ${REPORT_JSON}`);
  console.log(`Wrote ${REPORT_MD}`);
  console.log(`Wrote ${AGENT_PROMPT_MD}`);
  console.log(`Overall: ${payload.overall_ok ? "OK" : "ISSUES"}`);

  process.exit(payload.overall_ok ? 0 : 1);
}

main();
