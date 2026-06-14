#!/usr/bin/env node
/**
 * Record deploy-fix outcome back into knowledge base (feedback loop).
 *
 * npm run deploy-check:result -- --pattern vercel-protection-401 --status fixed --notes "Added bypass secret" [--pr URL]
 * npm run deploy-check:result -- --pattern unknown --status failed --notes "Still 401 after redeploy" --add-match "share link expired"
 */
import { readKnowledge, writeKnowledge, appendLog } from "./knowledge-io.mjs";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

const patternId = arg("--pattern") ?? arg("--failure-id");
const status = arg("--status");
const notes = arg("--notes") ?? "";
const prUrl = arg("--pr");
const addMatch = arg("--add-match");
const newPatternJson = arg("--new-pattern");

const VALID = new Set(["fixed", "failed", "partial"]);

if (!patternId || !status || !VALID.has(status)) {
  console.error(
    "Usage: --pattern <id> --status fixed|failed|partial [--notes text] [--pr url] [--add-match substring]",
  );
  process.exit(1);
}

const knowledge = readKnowledge();
let pattern = knowledge.patterns.find((p) => p.id === patternId);

if (!pattern && newPatternJson) {
  try {
    pattern = JSON.parse(newPatternJson);
    pattern.fixAttempts = [];
    knowledge.patterns.push(pattern);
    knowledge.checkSuiteVersion = (knowledge.checkSuiteVersion ?? 1) + 1;
    appendLog(knowledge, `new pattern added id=${pattern.id} suite v${knowledge.checkSuiteVersion}`);
  } catch {
    console.error("Invalid --new-pattern JSON");
    process.exit(1);
  }
}

if (!pattern) {
  console.error(`Unknown pattern "${patternId}". Use an id from knowledge-seed.json or --new-pattern.`);
  process.exit(1);
}

pattern.fixAttempts = pattern.fixAttempts ?? [];
pattern.fixAttempts.push({
  at: new Date().toISOString(),
  status,
  notes,
  prUrl: prUrl ?? null,
});

if (addMatch) {
  pattern.match = [...new Set([...(pattern.match ?? []), addMatch])];
  knowledge.checkSuiteVersion = (knowledge.checkSuiteVersion ?? 1) + 1;
  appendLog(knowledge, `pattern ${patternId} match extended: "${addMatch}" → suite v${knowledge.checkSuiteVersion}`);
}

if (status === "fixed") {
  appendLog(knowledge, `FIXED pattern=${patternId} pr=${prUrl ?? "-"} notes=${notes.slice(0, 120)}`);
} else {
  appendLog(knowledge, `FAILED pattern=${patternId} status=${status} notes=${notes.slice(0, 120)}`);
}

writeKnowledge(knowledge);
console.log(`Recorded ${status} for pattern "${patternId}" (suite v${knowledge.checkSuiteVersion})`);
