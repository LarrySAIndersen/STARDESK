#!/usr/bin/env node
/**
 * Pick next open kodepraksis item (one per tick) and emit agent instructions + markdown report.
 *
 * Usage:
 *   node run-tick.mjs           # start/continue next item
 *   node run-tick.mjs --status  # summary only
 */
import fs from "node:fs";
import { EXEC_ORDER, planByNumber } from "./kodepraksis-plan.mjs";
import { appendLog, getItem, readQueue, writeQueue, LATEST_PATH, QUEUE_PATH } from "./queue-io.mjs";

const statusOnly = process.argv.includes("--status");

function nextOpenItem(queue) {
  if (queue.currentN) {
    const cur = getItem(queue, queue.currentN);
    if (cur && (cur.status === "open" || cur.status === "in_progress")) {
      return cur;
    }
  }
  for (const n of EXEC_ORDER) {
    const item = getItem(queue, n);
    if (item && item.status === "open") {
      return item;
    }
  }
  for (const n of EXEC_ORDER) {
    const item = getItem(queue, n);
    if (item && item.status === "deferred") {
      return item;
    }
  }
  return null;
}

function summarize(queue) {
  const counts = { open: 0, in_progress: 0, done: 0, partial: 0, deferred: 0, wontfix: 0 };
  for (const i of queue.items) {
    counts[i.status] = (counts[i.status] ?? 0) + 1;
  }
  return counts;
}

function formatItemReport(n, queueItem) {
  const plan = planByNumber(n);
  if (!plan) {
    return `Unknown item #${n}`;
  }
  const lines = [
    `# Kodepraksis tick — punkt #${n}`,
    "",
    `**${plan.title}** (${plan.category})`,
    "",
    `| Felt | Værdi |`,
    `|------|-------|`,
    `| Relevans | ${plan.relevance} |`,
    `| Inkrementelt | ${plan.incremental ? "ja" : "nej"} |`,
    `| Queue status | ${queueItem?.status ?? "—"} |`,
    `| Forsøg | ${queueItem?.attempts ?? 0} |`,
    `| Sidste fallback | ${queueItem?.lastFallback ?? "—"} |`,
    "",
    "## Primær scope",
    plan.primaryScope,
    "",
    "## Verifikation",
    ...plan.verify.map((v) => `- \`${v}\``),
    "",
    "## Fallback-ladder (kør i rækkefølge ved fejl)",
  ];
  plan.fallback.forEach((f, i) => {
    lines.push(`### ${i + 1}. ${f.level.toUpperCase()} — ${f.when}`);
    lines.push(f.scope);
    lines.push("");
  });
  if (plan.blockedBy.length) {
    lines.push(`**Blokeret af:** #${plan.blockedBy.join(", #")} (afslut eller partial først)`);
    lines.push("");
  }
  lines.push("## Debate note");
  lines.push(plan.debateNote);
  lines.push("");
  lines.push("## Agent — denne tick");
  lines.push("1. Implementér **primær scope**.");
  lines.push("2. Kør verifikation. Ved fejl: prøv **partial** → **defer** → **skip** (dokumentér i queue).");
  lines.push("3. `bash scripts/run-deliverable-gate.sh` (+ `--full` ved web).");
  lines.push("4. PR mod `staging` (ikke Sonar-loop — normal PR-only).");
  lines.push("5. Afslut tick: `npm run kodepraksis:result -- --n " + n + " --status done|partial|deferred|wontfix [--fallback partial] [--notes \"...\"] [--pr URL]`");
  return lines.join("\n");
}

function main() {
  let queue = readQueue();
  if (!queue) {
    console.error("Queue missing. Run: npm run kodepraksis:init");
    process.exit(1);
  }

  const counts = summarize(queue);
  console.log("Kodepraksis queue:", counts);
  console.log("Path:", QUEUE_PATH);

  if (statusOnly) {
    const open = queue.items.filter((i) => i.status === "open").map((i) => i.n);
    console.log("Open (exec order):", open.join(", ") || "(none)");
    return;
  }

  const next = nextOpenItem(queue);
  if (!next) {
    console.log("All items done, wontfix, or deferred with no reopen. Queue complete.");
    return;
  }

  const plan = planByNumber(next.n);
  if (!plan) {
    console.error("Plan missing for", next.n);
    process.exit(1);
  }

  for (const blocker of plan.blockedBy) {
    const b = getItem(queue, blocker);
    if (b && b.status !== "done" && b.status !== "partial" && b.status !== "wontfix") {
      console.warn(`Warning: #${next.n} blocked by #${blocker} (status=${b.status}). Consider finishing blocker first.`);
    }
  }

  next.status = "in_progress";
  next.attempts = (next.attempts ?? 0) + 1;
  queue.currentN = next.n;
  appendLog(queue, `tick start #${next.n} attempt ${next.attempts}`);
  writeQueue(queue);

  const md = formatItemReport(next.n, next);
  fs.mkdirSync(LATEST_PATH.replace(/[/\\][^/\\]+$/, ""), { recursive: true });
  fs.writeFileSync(LATEST_PATH, `${md}\n`, "utf8");

  console.log("\n---\n");
  console.log(md);
  console.log("\n---\n");
  console.log("Report:", LATEST_PATH);
}

main();
