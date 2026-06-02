#!/usr/bin/env node
/** Write workboard/constitution/STARDESK-kodepraksis-50-plan.md from kodepraksis-plan.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { orderedPlanItems, EXEC_ORDER } from "./kodepraksis-plan.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(__dirname, "../../workboard/constitution/STARDESK-kodepraksis-50-plan.md");

const lines = [
  "# STARDESK kodepraksis-50 — eksekveringsplan",
  "",
  "> Auto-genereret fra `scripts/kodepraksis-agent/kodepraksis-plan.mjs`.",
  "> Kør `npm run kodepraksis:export-plan` efter plan-ændringer.",
  "> Tick-for-tick: `npm run kodepraksis:tick` · Queue: `reports/kodepraksis-agent-queue.json`",
  "",
  "## Fallback-regel (alle punkter)",
  "",
  "1. **Primær** — fuld scope i punktet.",
  "2. **Partial** — mindre scope (se kolonne).",
  "3. **Defer** — parkér i queue (`deferred`), fortsæt næste punkt.",
  "4. **Skip** — `wontfix` med note når irrelevant.",
  "",
  "Afslut hver tick: deliverable gate + PR mod `staging` + `npm run kodepraksis:result`.",
  "",
  "## Kø-rækkefølge",
  "",
  EXEC_ORDER.map((n) => `#${n}`).join(" → "),
  "",
  "## Plan-tabel",
  "",
  "| # | Kategori | Titel | Primær | Partial fallback | Defer når |",
  "|---|----------|-------|--------|------------------|-----------|",
];

for (const p of orderedPlanItems()) {
  const partial = p.fallback.find((f) => f.level === "partial");
  const defer = p.fallback.find((f) => f.level === "defer");
  const esc = (s) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  lines.push(
    `| ${p.n} | ${p.category} | ${esc(p.title)} | ${esc(p.primaryScope)} | ${partial ? esc(partial.scope) : "—"} | ${defer ? esc(defer.when) : "—"} |`,
  );
}

lines.push("");
lines.push("---");
lines.push("");
lines.push("Se også [STARDESK-kodepraksis-50.md](./STARDESK-kodepraksis-50.md) for scorecard og rationale.");

fs.writeFileSync(out, `${lines.join("\n")}\n`, "utf8");
console.log("Wrote", out);
