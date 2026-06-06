#!/usr/bin/env node
/**
 * Full coverage pipeline: pytest → parse report → canvas sync.
 *
 *   npm run coverage:pipeline
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runNode(scriptName, args = []) {
  const scriptPath = path.join(__dirname, scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: path.join(__dirname, ".."),
    env: process.env,
    stdio: "inherit",
  });
  return result.status ?? 1;
}

function main() {
  console.log("=== STARDESK Coverage Pipeline ===");

  const agentCode = runNode("run-coverage-agent.mjs");
  if (agentCode !== 0) {
    process.exit(agentCode);
  }

  const syncCode = runNode("sync-coverage-to-canvas.mjs");
  process.exit(syncCode);
}

main();
