import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../..");
export const SEED_PATH = path.join(__dirname, "knowledge-seed.json");
export const KNOWLEDGE_PATH = path.join(REPO_ROOT, "reports/deploy-check-knowledge.json");
export const LATEST_JSON = path.join(REPO_ROOT, "reports/deploy-check-latest.json");
export const LATEST_MD = path.join(REPO_ROOT, "reports/deploy-check-latest.md");
export const AGENT_PROMPT = path.join(REPO_ROOT, "reports/deploy-check-agent-prompt.md");

/** @typedef {{ id: string, match: string[], category: string, diagnosis: string, suggestedFix: string, checks: string[], fixAttempts?: FixAttempt[] }} Pattern */

/**
 * @typedef {object} FixAttempt
 * @property {string} at
 * @property {'fixed'|'failed'|'partial'} status
 * @property {string} notes
 * @property {string|null} prUrl
 */

/**
 * @typedef {object} KnowledgeFile
 * @property {number} version
 * @property {number} checkSuiteVersion
 * @property {Pattern[]} patterns
 * @property {object[]} checkDefinitions
 * @property {string[]} activityLog
 * @property {object[]} scanHistory
 */

export function readSeed() {
  return /** @type {KnowledgeFile} */ (JSON.parse(fs.readFileSync(SEED_PATH, "utf8")));
}

export function readKnowledge() {
  const seed = readSeed();
  if (!fs.existsSync(KNOWLEDGE_PATH)) {
    return { ...seed, activityLog: [], scanHistory: [] };
  }
  const live = /** @type {KnowledgeFile} */ (JSON.parse(fs.readFileSync(KNOWLEDGE_PATH, "utf8")));
  const mergedPatterns = mergePatterns(seed.patterns, live.patterns ?? []);
  return {
    ...seed,
    ...live,
    patterns: mergedPatterns,
    checkDefinitions: live.checkDefinitions?.length ? live.checkDefinitions : seed.checkDefinitions,
    activityLog: live.activityLog ?? [],
    scanHistory: live.scanHistory ?? [],
    checkSuiteVersion: Math.max(seed.checkSuiteVersion ?? 1, live.checkSuiteVersion ?? 1),
  };
}

function mergePatterns(seedPatterns, livePatterns) {
  const byId = new Map(seedPatterns.map((p) => [p.id, { ...p }]));
  for (const live of livePatterns) {
    const base = byId.get(live.id);
    if (base) {
      byId.set(live.id, {
        ...base,
        ...live,
        match: [...new Set([...(base.match ?? []), ...(live.match ?? [])])],
        fixAttempts: live.fixAttempts ?? base.fixAttempts ?? [],
      });
    } else {
      byId.set(live.id, live);
    }
  }
  return [...byId.values()];
}

export function writeKnowledge(knowledge) {
  fs.mkdirSync(path.dirname(KNOWLEDGE_PATH), { recursive: true });
  fs.writeFileSync(KNOWLEDGE_PATH, `${JSON.stringify(knowledge, null, 2)}\n`, "utf8");
}

export function appendLog(knowledge, line) {
  knowledge.activityLog = knowledge.activityLog ?? [];
  knowledge.activityLog.push(`${new Date().toISOString()} ${line}`);
  if (knowledge.activityLog.length > 300) {
    knowledge.activityLog = knowledge.activityLog.slice(-300);
  }
}

export function recordScan(knowledge, scanResult) {
  knowledge.scanHistory = knowledge.scanHistory ?? [];
  knowledge.scanHistory.push({
    at: scanResult.at,
    target: scanResult.target,
    passed: scanResult.passed,
    failureIds: scanResult.failureIds ?? [],
    commit: scanResult.commit ?? null,
  });
  if (knowledge.scanHistory.length > 100) {
    knowledge.scanHistory = knowledge.scanHistory.slice(-100);
  }
}
