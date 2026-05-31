import fs from "node:fs";

import path from "node:path";

import { fileURLToPath } from "node:url";



const __dirname = path.dirname(fileURLToPath(import.meta.url));

const scriptsRoot = path.resolve(__dirname, "..");

const repoRoot = path.resolve(scriptsRoot, "..");



const SAFE_TASK_ID = /^[a-zA-Z0-9_-]{1,128}$/;

const SAFE_MANIFEST_FILE = /^[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp)$/i;



export function assertSafeTaskId(taskId) {

  const id = String(taskId ?? "").trim();

  if (!id || !SAFE_TASK_ID.test(id) || id.includes("..")) {

    throw new Error(`Invalid task id: ${taskId}`);

  }

  return id;

}



export function assertSafeManifestFilename(name) {

  const raw = String(name ?? "").trim();

  const base = path.basename(raw);

  if (!base || base !== raw || base.includes("..") || !SAFE_MANIFEST_FILE.test(base)) {

    throw new Error(`Invalid manifest filename: ${name}`);

  }

  return base;

}



export function resolvePathUnderBase(baseDir, segment) {

  const safe = assertSafeTaskId(segment);

  const base = path.resolve(baseDir);

  const target = path.resolve(base, safe);

  const baseWithSep = base.endsWith(path.sep) ? base : `${base}${path.sep}`;

  if (target !== base && !target.startsWith(baseWithSep)) {

    throw new Error(`Path escapes base directory: ${segment}`);

  }

  return target;

}



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

  const configured = process.env.WORKBOARD_DATA_PATH;

  if (!configured) {

    return defaultWorkboardDataPath();

  }

  const resolved = path.resolve(configured);

  if (!fs.existsSync(resolved)) {

    throw new Error(`Work Board data not found: ${resolved}`);

  }

  return resolved;

}



export function resolveReviewEvidenceDir(taskId) {

  const base = process.env.REVIEW_EVIDENCE_DIR || path.join(repoRoot, "reports", "review-evidence");

  return resolvePathUnderBase(base, taskId);

}



export function resolveReviewRejectAttachmentsDir(taskId) {

  const base =

    process.env.REVIEW_REJECT_ATTACHMENTS_DIR ||

    path.join(repoRoot, "reports", "review-reject-attachments");

  return resolvePathUnderBase(base, taskId);

}



export function safeJoinUnderDir(dir, filename) {

  const safeName = assertSafeManifestFilename(filename);

  const base = path.resolve(dir);

  const target = path.resolve(base, safeName);

  const baseWithSep = base.endsWith(path.sep) ? base : `${base}${path.sep}`;

  if (!target.startsWith(baseWithSep)) {

    throw new Error(`Manifest path escapes evidence dir: ${filename}`);

  }

  return target;

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

