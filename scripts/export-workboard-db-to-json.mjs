#!/usr/bin/env node
/**
 * Export workboard_tasks from API → JSON file for canvas recovery.
 *
 * Env: STARDESK_API_URL, STARDESK_API_TOKEN
 * Optional: WORKBOARD_EXPORT_PATH (default: workboard-tasks-export.json in cwd)
 */
import fs from "node:fs";
import path from "node:path";
import {
  assertConfiguredApiBaseUrl,
  failWithCode,
  logScriptCode,
  logScriptError,
  runScriptMain,
} from "./lib/script-security.mjs";

const token = process.env.STARDESK_API_TOKEN || "";
const outPath =
  process.env.WORKBOARD_EXPORT_PATH ||
  path.join(process.cwd(), "workboard-tasks-export.json");

async function main() {
  if (!token) {
    failWithCode("MISSING_API_TOKEN");
  }
  const apiUrl = assertConfiguredApiBaseUrl(
    (process.env.STARDESK_API_URL || "").replace(/\/$/, ""),
  );
  const res = await fetch(`${apiUrl}/api/v1/workboard/tasks/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    logScriptError("WORKBOARD_EXPORT_FAILED", `HTTP ${res.status}`);
    process.exit(1);
  }
  const tasks = JSON.parse(text);
  fs.writeFileSync(
    outPath,
    JSON.stringify({ "stardesk-tasks-v1": tasks }, null, 2),
    "utf8",
  );
  logScriptCode("WORKBOARD_EXPORT_OK");
}

runScriptMain(main);
