#!/usr/bin/env node
/**
 * Run Playwright smoke + import evidence (local JSON and/or Neon via API).
 *
 * Usage:
 *   node scripts/run-review-playwright-pipeline.mjs --task 54
 *   node scripts/run-review-playwright-pipeline.mjs --task 54 --export-from-api --push-to-api
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsRoot = __dirname;

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {
    taskNumber: null,
    exportFromApi: false,
    pushToApi: false,
    continueOnPlaywrightFailure: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--export-from-api") {
      out.exportFromApi = true;
      continue;
    }
    if (arg === "--push-to-api") {
      out.pushToApi = true;
      continue;
    }
    if (arg === "--continue-on-failure") {
      out.continueOnPlaywrightFailure = true;
      continue;
    }
    const next = argv[i + 1];
    if ((arg === "--task" || arg === "--task-number") && next) {
      out.taskNumber = next;
      i += 1;
    }
  }
  return out;
}

function runNode(scriptName, extraArgs) {
  const scriptPath = path.join(scriptsRoot, scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...extraArgs], {
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? 1;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.taskNumber == null) {
    fail("Provide --task <number>.");
  }

  const sharedArgs = [`--task`, String(args.taskNumber)];
  if (args.exportFromApi) sharedArgs.push("--export-from-api");

  console.log(`\n=== Playwright pipeline for task #${args.taskNumber} ===\n`);

  const runStatus = runNode("run-review-playwright.mjs", sharedArgs);
  if (runStatus !== 0 && !args.continueOnPlaywrightFailure) {
    fail(`run-review-playwright.mjs exited ${runStatus}`);
  }

  const importArgs = [...sharedArgs];
  if (args.pushToApi) importArgs.push("--push-to-api");

  const importStatus = runNode("import-playwright-evidence-to-workboard.mjs", importArgs);
  if (importStatus !== 0) {
    fail(`import-playwright-evidence-to-workboard.mjs exited ${importStatus}`);
  }

  console.log(`\nPipeline complete for task #${args.taskNumber}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
