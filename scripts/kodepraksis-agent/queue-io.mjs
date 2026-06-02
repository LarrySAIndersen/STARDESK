import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../..");
export const QUEUE_PATH = path.join(REPO_ROOT, "reports/kodepraksis-agent-queue.json");
export const LATEST_PATH = path.join(REPO_ROOT, "reports/kodepraksis-agent-latest.md");

/** @typedef {'open'|'in_progress'|'done'|'partial'|'deferred'|'wontfix'} ItemStatus */

/**
 * @typedef {object} QueueItem
 * @property {number} n
 * @property {ItemStatus} status
 * @property {number} attempts
 * @property {string|null} lastFallback
 * @property {string|null} notes
 * @property {string|null} prUrl
 * @property {string|null} completedAt
 */

/**
 * @typedef {object} QueueFile
 * @property {string} version
 * @property {string} source
 * @property {string} updatedAt
 * @property {number|null} currentN
 * @property {QueueItem[]} items
 * @property {string[]} activityLog
 */

export function readQueue() {
  if (!fs.existsSync(QUEUE_PATH)) {
    return null;
  }
  return /** @type {QueueFile} */ (JSON.parse(fs.readFileSync(QUEUE_PATH, "utf8")));
}

export function writeQueue(queue) {
  fs.mkdirSync(path.dirname(QUEUE_PATH), { recursive: true });
  queue.updatedAt = new Date().toISOString();
  fs.writeFileSync(QUEUE_PATH, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
}

export function appendLog(queue, line) {
  const entry = `${new Date().toISOString()} ${line}`;
  queue.activityLog = queue.activityLog ?? [];
  queue.activityLog.push(entry);
  if (queue.activityLog.length > 200) {
    queue.activityLog = queue.activityLog.slice(-200);
  }
}

export function getItem(queue, n) {
  return queue.items.find((i) => i.n === n);
}
