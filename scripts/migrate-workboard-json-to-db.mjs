#!/usr/bin/env node
/**
 * One-time / repeatable import: stardesk-workboard.canvas.data.json → Neon via API.
 *
 * Env:
 *   STARDESK_API_URL   — e.g. https://api-gamma-amber.vercel.app
 *   STARDESK_API_TOKEN — Bearer JWT (staff/admin); login via /api/v1/auth/login
 *
 * Optional:
 *   WORKBOARD_DATA_PATH — override canvas.data.json path
 *   WORKBOARD_REPLACE_MISSING=1 — soft-delete DB tasks not in JSON
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const home = process.env.USERPROFILE || process.env.HOME || "";
const defaultDataPath = path.join(
  home,
  ".cursor",
  "projects",
  "c-Users-kjaer-STARDESK-Cursor",
  "canvases",
  "stardesk-workboard.canvas.data.json",
);

const apiUrl = (process.env.STARDESK_API_URL || "").replace(/\/$/, "");
const token = process.env.STARDESK_API_TOKEN || "";
const dataPath = process.env.WORKBOARD_DATA_PATH || defaultDataPath;
const replaceMissing = process.env.WORKBOARD_REPLACE_MISSING === "1";

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function main() {
  if (!apiUrl) fail("Set STARDESK_API_URL (Vercel API base URL).");
  if (!token) fail("Set STARDESK_API_TOKEN (staff JWT from /api/v1/auth/login).");
  if (!fs.existsSync(dataPath)) fail(`Work Board data not found: ${dataPath}`);

  const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const tasks = Array.isArray(raw["stardesk-tasks-v1"])
    ? raw["stardesk-tasks-v1"]
    : Array.isArray(raw.tasks)
      ? raw.tasks
      : [];
  if (tasks.length === 0) fail("No tasks in stardesk-tasks-v1.");

  const res = await fetch(`${apiUrl}/api/v1/workboard/tasks/bulk-import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tasks, replace_missing: replaceMissing }),
  });

  const body = await res.text();
  if (!res.ok) {
    fail(`Import failed (${res.status}): ${body}`);
  }
  console.log("Work Board import OK:", body);
  console.log(`Source: ${dataPath} (${tasks.length} tasks)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
