#!/usr/bin/env node
/**
 * Full performance pipeline: swarm → merge report → canvas sync.
 *
 *   npm run perf:pipeline
 *   npm run perf:pipeline -- stress
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPerfEnv } from "./load-perf-env.mjs";
import { buildPerformanceReport } from "./build-performance-report.mjs";
import { buildPerformanceEvidence } from "./build-performance-evidence.mjs";
import { buildPerformanceSharePack } from "./export-performance-share-pack.mjs";
import { resolveCommandPath } from "../lib/script-security.mjs";

loadPerfEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.resolve(__dirname, "..");

function runNode(scriptRel, args = []) {
  const scriptPath = path.join(__dirname, scriptRel);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: SCRIPTS_DIR,
    env: process.env,
    stdio: "inherit",
  });
  return result.status ?? 1;
}

async function main() {
  const scenario = process.argv[2] || "baseline";

  console.log("=== Performance pipeline ===");

  const swarmCode = runNode("run-performance-agent.mjs", [scenario]);
  if (swarmCode !== 0) {
    console.warn("Swarm reported failures — continuing to merge reports.");
  }

  let reportPass = true;
  try {
    buildPerformanceEvidence();
    const { report, outMd } = buildPerformanceReport();
    reportPass = report.pass;
    console.log(`Report: ${outMd}`);
    console.log(`Evidence: reports/performance-evidence-latest.md`);
    try {
      const share = buildPerformanceSharePack();
      console.log(`Share pack: ${path.relative(path.resolve(__dirname, "../.."), share.indexHtml)}`);
      if (share.zipPath) {
        console.log(`Share zip: reports/performance-share-pack.zip`);
      }
    } catch (shareErr) {
      console.warn(`Share pack skipped: ${shareErr?.message || shareErr}`);
    }
  } catch (err) {
    console.error(String(err?.message || err));
    process.exit(2);
  }

  const syncCode = runNode("sync-performance-to-canvas.mjs");
  if (syncCode !== 0) {
    process.exit(syncCode);
  }

  if (process.env.PERF_PERSIST_DB === "1") {
    console.log("=== Persist benchmarks to DB (PERF_PERSIST_DB=1) ===");
    const persistScript = path.join(__dirname, "persist_benchmark_to_db.py");
    const apiDir = path.resolve(__dirname, "../../apps/api");
    const uvPath = resolveCommandPath("uv");
    if (!uvPath) {
      console.warn("uv not found on PATH — skipping DB persist.");
    } else {
      const persist = spawnSync(uvPath, ["run", "python", persistScript], {
        cwd: apiDir,
        env: process.env,
        stdio: "inherit",
        shell: false,
      });
      if ((persist.status ?? 1) !== 0) {
        console.warn("DB persist failed — reports still on disk.");
      }
    }
  }

  process.exit(swarmCode === 0 && reportPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(2);
});
