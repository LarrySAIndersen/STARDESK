#!/usr/bin/env node
/**
 * Skriver STARDESK/Background/AGENT-RERUN-QUEUE.md fra Work Board canvas-data.
 * Lister alle opgaver i In Progress (auto-start agent + session-prioritet).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const home = process.env.USERPROFILE || process.env.HOME || "";
const dataPath = path.join(
  home,
  ".cursor",
  "projects",
  "c-Users-kjaer-STARDESK-Cursor",
  "canvases",
  "stardesk-workboard.canvas.data.json",
);

const outPath = path.join(repoRoot, "Background", "AGENT-RERUN-QUEUE.md");

function parseRejection(description) {
  const match = description.match(
    /--- Review afvist ---\s*\nBegrundelse:\s*([\s\S]*?)(?:\n\n---|\s*$)/,
  );
  return match?.[1]?.trim() ?? "";
}

function needsRerun(task) {
  if (task.agentRerunRequired) return true;
  const description = String(task.description ?? "");
  return (
    description.includes("--- Review afvist ---") ||
    description.includes("--- AGENT GENKØRSEL PÅKRÆVET ---")
  );
}

function priorityRank(priority) {
  const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return order[priority] ?? 9;
}

function main() {
  if (!fs.existsSync(dataPath)) {
    console.error("Work Board data ikke fundet:", dataPath);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const tasks = Array.isArray(raw["stardesk-tasks-v1"])
    ? raw["stardesk-tasks-v1"]
    : Array.isArray(raw.tasks)
      ? raw.tasks
      : [];
  const pending = tasks
    .filter((task) => task.status === "In Progress")
    .sort((a, b) => {
      const pr = priorityRank(a.priority) - priorityRank(b.priority);
      if (pr !== 0) return pr;
      return (a.number ?? 0) - (b.number ?? 0);
    });

  const lines = [
    "# Agent-kø (Work Board — I gang)",
    "",
    "Alle opgaver i **In Progress**. Work Board starter agent automatisk ved flyt til kolonnen.",
    "Cursor-agent ved sessionstart: vælg højeste prioritet (P0 først), implementér, derefter **Review**.",
    "",
    `Sidst synkroniseret: ${new Date().toISOString()}`,
    "",
  ];

  if (pending.length === 0) {
    lines.push("_Ingen opgaver i I gang._", "");
  } else {
    for (const task of pending) {
      const rerun = needsRerun(task);
      const reason =
        task.agentRerunReason?.trim() || parseRejection(task.description ?? "");
      lines.push(
        `## #${task.number} ${task.title}`,
        "",
        `- **Status:** ${task.status}`,
        `- **Prioritet:** ${task.priority ?? "—"}`,
        `- **Type:** ${rerun ? "Genkørsel (Review afvist)" : "Første gangs implementering"}`,
        "",
      );
      if (rerun) {
        lines.push(
          "### Begrundelse (skal adresseres)",
          "",
          reason || "(ingen begrundelse fundet)",
          "",
        );
      } else {
        lines.push(
          "### Handling",
          "",
          "Implementér efter kodningsklar spec i Work Board-beskrivelsen.",
          "",
        );
      }
      lines.push("---", "");
    }
  }

  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Skrev ${pending.length} opgave(r) i I gang til ${outPath}`);
}

main();
