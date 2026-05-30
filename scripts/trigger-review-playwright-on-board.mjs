#!/usr/bin/env node
/**
 * Scan Work Board for Review tasks with pending Playwright evidence and run pipeline.
 *
 * Usage:
 *   node scripts/trigger-review-playwright-on-board.mjs
 *   node scripts/trigger-review-playwright-on-board.mjs --export-from-api --push-to-api
 *   node scripts/trigger-review-playwright-on-board.mjs --dry-run
 */
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchTasksFromApi } from "./lib/workboard-api.mjs";
import { readWorkboardTasks, resolveWorkboardDataPath } from "./lib/workboard-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { exportFromApi: false, pushToApi: false, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--export-from-api") out.exportFromApi = true;
    else if (arg === "--push-to-api") out.pushToApi = true;
    else if (arg === "--dry-run") out.dryRun = true;
  }
  return out;
}

async function loadTasks(exportFromApi) {
  if (exportFromApi) {
    return fetchTasksFromApi();
  }
  const dataPath = resolveWorkboardDataPath();
  if (!fs.existsSync(dataPath)) {
    fail(`Work Board data not found: ${dataPath}. Use --export-from-api in CI.`);
  }
  return readWorkboardTasks(dataPath).tasks;
}

function findPendingTasks(tasks) {
  return tasks.filter(
    (task) =>
      task.status === "Review" &&
      task.reviewPlaywrightEvidence?.status === "pending" &&
      (task.reviewVerificationScope === "stardesk" ||
        task.reviewPlaywrightEvidence?.verificationUrl),
  );
}

function runPipeline(taskNumber, args) {
  const pipelineArgs = [
    path.join(__dirname, "run-review-playwright-pipeline.mjs"),
    "--task",
    String(taskNumber),
    "--continue-on-failure",
  ];
  if (args.exportFromApi) pipelineArgs.push("--export-from-api");
  if (args.pushToApi) pipelineArgs.push("--push-to-api");

  const result = spawnSync(process.execPath, pipelineArgs, {
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? 1;
}

async function main() {
  const args = parseArgs(process.argv);
  const tasks = await loadTasks(args.exportFromApi);
  const pending = findPendingTasks(tasks);

  if (pending.length === 0) {
    console.log("No Review tasks with pending Playwright evidence.");
    return;
  }

  console.log(
    `Found ${pending.length} task(s) with pending Playwright evidence:`,
    pending.map((t) => `#${t.number}`).join(", "),
  );

  if (args.dryRun) {
    for (const task of pending) {
      console.log(
        `- #${task.number} (${task.id}): ${task.reviewPlaywrightEvidence?.verificationUrl ?? task.reviewVerificationUrl ?? "no url"}`,
      );
    }
    return;
  }

  let failures = 0;
  for (const task of pending) {
    console.log(`\n--- Running pipeline for #${task.number} ---`);
    const status = runPipeline(task.number, args);
    if (status !== 0) failures += 1;
  }

  if (failures > 0) {
    fail(`${failures} pipeline run(s) failed.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
