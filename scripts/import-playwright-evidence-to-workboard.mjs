#!/usr/bin/env node
/**
 * Import Playwright manifest + PNGs into stardesk-workboard.canvas.data.json
 * field reviewPlaywrightEvidence (base64 data URLs, resized if huge).
 *
 * Usage:
 *   node scripts/import-playwright-evidence-to-workboard.mjs --task 54
 *   node scripts/import-playwright-evidence-to-workboard.mjs --task-id t-54
 *   node scripts/import-playwright-evidence-to-workboard.mjs --task 54 --export-from-api --push-to-api
 */
import fs from "node:fs";
import path from "node:path";
import {
  fetchTasksFromApi,
  pushTaskToApi,
  resolveApiConfig,
} from "./lib/workboard-api.mjs";
import {
  findTaskByNumber,
  readWorkboardTasks,
  resolveReviewEvidenceDir,
  resolveWorkboardDataPath,
  safeJoinUnderDir,
} from "./lib/workboard-paths.mjs";

const MAX_DATA_URL_CHARS = 520_000;

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {
    taskNumber: null,
    taskId: null,
    exportFromApi: false,
    pushToApi: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--export-from-api") {
      out.exportFromApi = true;
    } else if (arg === "--push-to-api") {
      out.pushToApi = true;
    } else if ((arg === "--task" || arg === "--task-number") && next) {
      out.taskNumber = next;
      i += 1;
    } else if (arg === "--task-id" && next) {
      out.taskId = next;
      i += 1;
    }
  }
  return out;
}

function fileToDataUrl(filePath) {
  const buf = fs.readFileSync(filePath);
  const base64 = buf.toString("base64");
  return `data:image/png;base64,${base64}`;
}

function loadManifestForTask(task) {
  const dir = resolveReviewEvidenceDir(task.id);
  const manifestPath = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    fail(`Manifest not found: ${manifestPath}. Run run-review-playwright.mjs first.`);
  }
  return { dir, manifest: JSON.parse(fs.readFileSync(manifestPath, "utf8")) };
}

function buildEvidence(manifest, dir) {
  const screenshots = [];
  const logLines = [manifest.log || ""];
  for (const shot of manifest.screenshots ?? []) {
    let dataUrl;
    try {
      const filePath = safeJoinUnderDir(dir, shot.file);
      dataUrl = fileToDataUrl(filePath);
    } catch {
      logLines.push(`(missing file: ${shot.file})`);
      continue;
    }
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      logLines.push(`(skipped oversized screenshot: ${shot.caption})`);
      continue;
    }
    screenshots.push({
      id: shot.id,
      caption: shot.caption,
      dataUrl,
    });
  }
  return {
    at: manifest.at ?? Date.now(),
    actor: "agent",
    status: manifest.status ?? "failed",
    username: manifest.username,
    verificationUrl: manifest.verificationUrl,
    log: logLines.filter(Boolean).join("\n"),
    screenshots,
  };
}

function appendActivityLog(task, evidence) {
  const entry = {
    at: Date.now(),
    actor: "agent",
    action: "Playwright-evidence importeret",
    detail: `${evidence.status} · ${evidence.screenshots.length} screenshot(s)`,
  };
  return {
    ...task,
    reviewPlaywrightEvidence: evidence,
    activityLog: [...(task.activityLog ?? []), entry],
  };
}

async function resolveTaskContext(args) {
  let tasks = [];
  let raw = null;
  let dataPath = null;

  if (args.exportFromApi) {
    tasks = await fetchTasksFromApi();
  } else {
    dataPath = resolveWorkboardDataPath();
    if (!fs.existsSync(dataPath)) fail(`Work Board data not found: ${dataPath}`);
    ({ raw, tasks } = readWorkboardTasks(dataPath));
  }

  let task = null;
  if (args.taskNumber != null) {
    task = findTaskByNumber(tasks, args.taskNumber);
    if (!task) fail(`No task #${args.taskNumber}`);
  } else if (args.taskId) {
    task = tasks.find((t) => t.id === args.taskId) ?? null;
    if (!task) fail(`No task id ${args.taskId}`);
  } else {
    fail("Provide --task <number> or --task-id <id>.");
  }

  return { task, tasks, raw, dataPath };
}

async function main() {
  const args = parseArgs(process.argv);
  const { task, tasks, raw, dataPath } = await resolveTaskContext(args);

  const { dir, manifest } = loadManifestForTask(task);
  const evidence = buildEvidence(manifest, dir);
  const updated = appendActivityLog(task, evidence);

  if (args.pushToApi) {
    const { apiUrl, token } = resolveApiConfig();
    if (!apiUrl || !token) {
      fail("Set STARDESK_API_URL and STARDESK_API_TOKEN for --push-to-api.");
    }
    await pushTaskToApi(updated);
    console.log(`Pushed #${task.number} (${task.id}) to API: ${evidence.status}`);
  }

  if (!args.exportFromApi && dataPath && raw) {
    const nextTasks = tasks.map((t) => (t.id === task.id ? updated : t));
    const out = { ...raw, "stardesk-tasks-v1": nextTasks };
    fs.writeFileSync(dataPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
    console.log(
      `Updated #${task.number} (${task.id}) reviewPlaywrightEvidence: ${evidence.status}, ${evidence.screenshots.length} images`,
    );
    console.log(`Source: ${dataPath}`);
  } else if (args.exportFromApi && !args.pushToApi) {
    console.log(
      `Built evidence for #${task.number} (${evidence.status}, ${evidence.screenshots.length} images). Use --push-to-api to persist.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

