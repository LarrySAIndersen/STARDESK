#!/usr/bin/env node
/**
 * Close a kodepraksis tick and advance queue.
 *
 * npm run kodepraksis:result -- --n 39 --status done [--fallback partial] [--notes "..."] [--pr URL]
 */
import { readQueue, writeQueue, appendLog, getItem } from "./queue-io.mjs";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

const n = Number(arg("--n"));
const status = arg("--status");
const fallback = arg("--fallback");
const notes = arg("--notes");
const prUrl = arg("--pr");

const VALID = new Set(["done", "partial", "deferred", "wontfix", "open", "in_progress"]);

if (!n || !status || !VALID.has(status)) {
  console.error("Usage: --n <1-50> --status done|partial|deferred|wontfix|open [--fallback level] [--notes text] [--pr url]");
  process.exit(1);
}

const queue = readQueue();
if (!queue) {
  console.error("Run npm run kodepraksis:init first");
  process.exit(1);
}

const item = getItem(queue, n);
if (!item) {
  console.error("Unknown item", n);
  process.exit(1);
}

item.status = status;
if (fallback) item.lastFallback = fallback;
if (notes) item.notes = notes;
if (prUrl) item.prUrl = prUrl;
if (status === "done" || status === "partial" || status === "wontfix") {
  item.completedAt = new Date().toISOString();
}

if (status === "done" || status === "partial" || status === "wontfix") {
  queue.currentN = null;
}

appendLog(queue, `tick end #${n} status=${status} fallback=${fallback ?? "-"} pr=${prUrl ?? "-"}`);
writeQueue(queue);
console.log(`Updated #${n} → ${status}`);
