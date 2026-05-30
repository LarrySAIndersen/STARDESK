import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(scriptsRoot, "..");

export function defaultWorkboardDataPath() {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  return path.join(
    home,
    ".cursor",
    "projects",
    "c-Users-kjaer-STARDESK-Cursor",
    "canvases",
    "stardesk-workboard.canvas.data.json",
  );
}

export function resolveWorkboardDataPath() {
  return process.env.WORKBOARD_DATA_PATH || defaultWorkboardDataPath();
}

export function resolveReviewEvidenceDir(taskId) {
  const base = process.env.REVIEW_EVIDENCE_DIR || path.join(repoRoot, "reports", "review-evidence");
  return path.join(base, taskId);
}

export function readWorkboardTasks(dataPath) {
  const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const tasks = Array.isArray(raw["stardesk-tasks-v1"])
    ? raw["stardesk-tasks-v1"]
    : Array.isArray(raw.tasks)
      ? raw.tasks
      : [];
  return { raw, tasks };
}

export function findTaskByNumber(tasks, taskNumber) {
  const n = Number(taskNumber);
  return tasks.find((t) => t.number === n) ?? null;
}

export function findTaskById(tasks, taskId) {
  return tasks.find((t) => t.id === taskId) ?? null;
}
