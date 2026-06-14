#!/usr/bin/env node
/**
 * Emit Cursor agent prompt when deploy check fails.
 */
import fs from "node:fs";
import path from "node:path";
import { AGENT_PROMPT, LATEST_JSON } from "./knowledge-io.mjs";

function main() {
  if (!fs.existsSync(LATEST_JSON)) {
    console.error("No deploy-check report — run npm run deploy-check:pipeline first");
    process.exit(1);
  }
  const report = JSON.parse(fs.readFileSync(LATEST_JSON, "utf8"));

  const lines = [
    "# STARDESK Deploy Check — agent handoff",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Target: **${report.target}**`,
    `Status: **${report.passed ? "PASSED" : "FAILED"}**`,
    `Commit: ${report.commit ?? "—"}`,
    "",
  ];

  if (report.passed) {
    lines.push("Deploy check passed. No action required.");
    lines.push("");
    lines.push("If you fixed a prior failure, record it:");
    lines.push("```bash");
    lines.push("cd scripts && npm run deploy-check:result -- --pattern <id> --status fixed --notes \"...\" --pr <url>");
    lines.push("```");
  } else {
    lines.push("## Failures");
    lines.push("");
    for (const f of report.failures ?? []) {
      lines.push(`### ${f.checkId ?? "check"} — ${f.message}`);
      for (const c of f.classification ?? []) {
        lines.push(`- **${c.id}** (${c.category}): ${c.diagnosis}`);
        lines.push(`  - Fix: ${c.suggestedFix}`);
        if (c.priorAttempts?.length) {
          const last = c.priorAttempts[c.priorAttempts.length - 1];
          lines.push(`  - Last attempt: ${last.status} — ${last.notes}`);
        }
      }
      lines.push("");
    }
    lines.push("## Agent workflow");
    lines.push("");
    lines.push("1. Read `.cursor/skills/stardesk-deploy-check/SKILL.md`");
    lines.push("2. Diagnose using Vercel logs + patterns above");
    lines.push("3. Fix on branch `cursor/deploy-fix-<slug>-a7ba` → draft PR to **staging**");
    lines.push("4. After merge + deploy: `npm run deploy-check:pipeline -- staging`");
    lines.push("5. Record outcome:");
    lines.push("```bash");
    lines.push("cd scripts && npm run deploy-check:result -- --pattern <id> --status fixed|failed --notes \"...\" --pr <url>");
    lines.push("```");
    lines.push("6. On success with new failure signature: add `--add-match \"substring\"`");
    lines.push("");
    lines.push("Refs: `docs/deploy-check-agent.md`, `docs/staging-vercel-preview-env.md`");
  }

  fs.mkdirSync(path.dirname(AGENT_PROMPT), { recursive: true });
  fs.writeFileSync(AGENT_PROMPT, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${AGENT_PROMPT}`);
}

main();
