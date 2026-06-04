#!/usr/bin/env node
/**
 * Performance agent swarm — runs JMeter + Playwright agents in parallel.
 *
 * Usage:
 *   node performance-agent/run-performance-agent.mjs [--jmeter-only|--playwright-only] [baseline|stress]
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPerfEnv } from "./load-perf-env.mjs";

loadPerfEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {
    jmeterOnly: false,
    playwrightOnly: false,
    scenario: "baseline",
    skipJmeter: process.env.PERF_SKIP_JMETER === "1",
    skipPlaywright: process.env.PERF_SKIP_PLAYWRIGHT === "1",
  };
  for (const arg of argv.slice(2)) {
    if (arg === "--jmeter-only") {
      out.jmeterOnly = true;
      out.skipPlaywright = true;
    } else if (arg === "--playwright-only") {
      out.playwrightOnly = true;
      out.skipJmeter = true;
    } else if (arg === "baseline" || arg === "stress") {
      out.scenario = arg;
    }
  }
  return out;
}

function runNode(scriptRel, args = []) {
  const scriptPath = resolve(__dirname, scriptRel);
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => resolvePromise(code ?? 1));
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const tasks = [];

  console.log("=== STARDESK Performance Agent Swarm ===");
  console.log(`Scenario: ${args.scenario}`);

  if (!args.skipJmeter) {
    tasks.push(
      runNode("jmeter/run-jmeter-agent.mjs", [args.scenario]).then((code) => ({
        agent: "jmeter",
        code,
      })),
    );
  }

  if (!args.skipPlaywright) {
    tasks.push(
      runNode("playwright/run-playwright-perf-agent.mjs").then((code) => ({
        agent: "playwright",
        code,
      })),
    );
  }

  if (tasks.length === 0) {
    console.error("No agents selected — remove PERF_SKIP_* or flags.");
    process.exit(2);
  }

  const results = await Promise.all(tasks);
  const failed = results.filter((r) => r.code !== 0);

  console.log("");
  console.log("=== Swarm summary ===");
  for (const r of results) {
    console.log(`${r.agent}: ${r.code === 0 ? "PASS" : "FAIL"} (exit ${r.code})`);
  }

  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(2);
});
