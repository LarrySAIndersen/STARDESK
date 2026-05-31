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
import {
  assertConfiguredApiBaseUrl,
  failWithCode,
  logScript,
  logScriptError,
} from "./lib/script-security.mjs";

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

const token = process.env.STARDESK_API_TOKEN || "";
const dataPath = process.env.WORKBOARD_DATA_PATH || defaultDataPath;
const replaceMissing = process.env.WORKBOARD_REPLACE_MISSING === "1";

async function main() {
  let apiUrl;
  try {
    apiUrl = assertConfiguredApiBaseUrl(process.env.STARDESK_API_URL || "");
  } catch {
    failWithCode("missing_api_url");
  }
  if (!token) failWithCode("missing_api_token");
  if (!fs.existsSync(dataPath)) failWithCode("workboard_data_not_found");

  const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const tasks = Array.isArray(raw["stardesk-tasks-v1"])
    ? raw["stardesk-tasks-v1"]
    : Array.isArray(raw.tasks)
      ? raw.tasks
      : [];
  if (tasks.length === 0) failWithCode("no_tasks_in_json");

  const res = await fetch(`${apiUrl}/api/v1/workboard/tasks/bulk-import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tasks, replace_missing: replaceMissing }),
  });

  if (!res.ok) {
    await res.text();
    logScriptError("import_failed", `status=${res.status}`);
    process.exit(1);
  }
  logScript("Work Board import OK");
}

main().catch(() => {
  logScriptError("import_error");
  process.exit(1);
});
