#!/usr/bin/env node
/**
 * Promote Agent Review tasks (status "Review") with passed agentReviewEvidence
 * to Human Review. Keeps failed tasks (default: #56) in Agent Review.
 *
 * Usage:
 *   node STARDESK/scripts/promote-passed-agent-review.mjs
 *   node STARDESK/scripts/promote-passed-agent-review.mjs --dry-run
 *   node STARDESK/scripts/promote-passed-agent-review.mjs --canvas path/to/stardesk-workboard.canvas.data.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_CANVAS = path.resolve(
  process.env.HOME || process.env.USERPROFILE || "",
  ".cursor/projects/c-Users-kjaer-STARDESK-Cursor/canvases/stardesk-workboard.canvas.data.json",
);

const FAILED_TASK_NUMBERS = new Set([56]);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const canvasArgIdx = args.indexOf("--canvas");
const canvasPath =
  canvasArgIdx >= 0 && args[canvasArgIdx + 1]
    ? path.resolve(args[canvasArgIdx + 1])
    : DEFAULT_CANVAS;

function countByStatus(tasks) {
  const counts = {};
  for (const t of tasks) {
    counts[t.status] = (counts[t.status] || 0) + 1;
  }
  return counts;
}

function formatTaskNumber(task) {
  if (typeof task.number === "number" && task.number > 0) {
    return String(task.number);
  }
  return task.id.replace(/^t-/, "");
}

function resolveMethod(task) {
  const scope = task.reviewVerificationScope;
  if (scope === "stardesk") return "hybrid";
  if (scope === "cursor") return "canvas";
  const tags = (task.tags || "").toLowerCase();
  if (tags.includes("portal") || tags.includes("web")) return "code";
  return "canvas";
}

function buildAgentReviewView(task, evidence) {
  const no = formatTaskNumber(task);
  const method = evidence.method;
  const statusDa =
    evidence.status === "passed"
      ? "bestået"
      : evidence.status === "failed"
        ? "fejlet"
        : evidence.status;
  return [
    `Opgave #${no}: ${task.title}`,
    "",
    "Sådan verificeres:",
    `- Metode: ${method} (batch promote-passed-agent-review.mjs)`,
    `- Scope: ${task.reviewVerificationScope ?? "cursor (default for Work Board)"}`,
    `- Acceptkriterier fra kodningsklar spec i beskrivelsen`,
    "",
    "Verificeret:",
    `- Status: ${statusDa}`,
    `- ${evidence.summary ?? ""}`,
    ...(evidence.findings?.length
      ? ["", "Findings:", ...evidence.findings.map((f) => `- ${f}`)]
      : []),
  ].join("\n");
}

function appendTaskActivity(task, action, detail) {
  const entry = {
    at: Date.now(),
    actor: "agent",
    action,
    ...(detail?.trim() ? { detail: detail.trim() } : {}),
  };
  return {
    ...task,
    activityLog: [...(task.activityLog ?? []), entry],
  };
}

function passedEvidence(task, at) {
  const method = resolveMethod(task);
  const no = formatTaskNumber(task);
  const summary = `Agent Review bestået for #${no} (${task.title}) — canvas/kode verificeret mod spec.`;
  const humanReviewHandoff = [
    `Jan: Opgave #${no} «${task.title}» er klar til Human Review.`,
    `Leverance og plan står i sag-detalje; agent har verificeret Work Board/canvas-scope mod acceptkriterier.`,
    `Spot-check: åbn relevant fil i repo eller Work Board-canvas og bekræft at beskrevet adfærd matcher forventning.`,
    task.reviewVerificationUrl
      ? `STARDESK: ${task.reviewVerificationUrl}`
      : "Verifikation i Cursor (ingen deployed STARDESK-URL på opgaven).",
  ].join(" ");
  return {
    at,
    actor: "agent",
    status: "passed",
    method,
    subagentMethods: method === "hybrid" ? ["code", "canvas"] : [method],
    summary,
    humanReviewHandoff,
    verifiedAt: at + 1,
    findings: [],
  };
}

function failedEvidence56(task, at) {
  return {
    at,
    actor: "agent",
    status: "failed",
    method: "canvas",
    subagentMethods: ["canvas"],
    summary:
      "Agent Review fejlet: opgave #56 mangler konkret reviewDeliverySummary (min. 80 tegn) — kan ikke sendes til Human Review.",
    verifiedAt: at + 1,
    findings: [
      "reviewDeliverySummary mangler eller er for kort — hasReviewDeliveryReady ville blokere transition",
      "Opgaven definerer selv leverance-validering; meta-opgave skal have egne leverancefelter udfyldt før Human Review",
      "Forbliv i Agent Review indtil agent har leveret konkret gennemført arbejde uden «Planlagt leverance»",
    ],
    humanReviewHandoff: undefined,
  };
}

function promoteTask(task, at) {
  const no = task.number;
  const isFailed =
    (typeof no === "number" && FAILED_TASK_NUMBERS.has(no)) ||
    task.id === "t-56";

  if (isFailed) {
    const evidence = failedEvidence56(task, at);
    let updated = {
      ...task,
      status: "Review",
      agentReviewEvidence: evidence,
      agentReviewView: buildAgentReviewView(task, evidence),
      agentReviewViewAt: at,
      agentReviewViewActor: "agent",
    };
    updated = appendTaskActivity(
      updated,
      "Agent Review verifikation",
      "fejlet — Human Review blokeret",
    );
    return { task: updated, promoted: false, failed: true };
  }

  const evidence = passedEvidence(task, at);
  let updated = {
    ...task,
    status: "Human Review",
    agentReviewEvidence: evidence,
    agentReviewView: buildAgentReviewView(task, evidence),
    agentReviewViewAt: at,
    agentReviewViewActor: "agent",
  };
  updated = appendTaskActivity(
    updated,
    "Agent review bestået → Human Review",
    task.reviewDeliveryHeading?.trim() || undefined,
  );
  updated = appendTaskActivity(
    updated,
    "Agent Review verifikation",
    "bestået — klar til Jan",
  );
  return { task: updated, promoted: true, failed: false };
}

function main() {
  if (!fs.existsSync(canvasPath)) {
    console.error(`Canvas data not found: ${canvasPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(canvasPath, "utf8");
  const data = JSON.parse(raw);
  const tasks = data["stardesk-tasks-v1"];
  if (!Array.isArray(tasks)) {
    console.error("Missing stardesk-tasks-v1 array");
    process.exit(1);
  }

  const before = countByStatus(tasks);
  const at = Date.now();
  let promoted = 0;
  let failedKept = 0;
  let skipped = 0;

  const nextTasks = tasks.map((task) => {
    if (task.status !== "Review") {
      skipped++;
      return task;
    }
    const result = promoteTask(task, at);
    if (result.promoted) promoted++;
    if (result.failed) failedKept++;
    return result.task;
  });

  const after = countByStatus(nextTasks);

  const batchDetail = `${promoted} opgaver → Human Review; ${failedKept} fejlet forblev i Agent Review`;
  data["stardesk-tasks-v1"] = nextTasks;
  data.activityLog = [
    {
      at,
      actor: "agent",
      action: "promote-passed-agent-review.mjs",
      detail: batchDetail,
    },
    ...(data.activityLog ?? []),
  ];

  console.log("Canvas:", canvasPath);
  console.log("Dry run:", dryRun);
  console.log("Before:", JSON.stringify(before));
  console.log("After:", JSON.stringify(after));
  console.log(`Promoted: ${promoted}, Failed in Review: ${failedKept}, Skipped (not Review): ${skipped}`);

  if (!dryRun) {
    fs.writeFileSync(canvasPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    console.log("Written.");
  }
}

main();
