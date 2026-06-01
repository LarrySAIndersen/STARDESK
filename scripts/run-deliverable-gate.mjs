#!/usr/bin/env node
/**
 * Cross-platform deliverable gate launcher.
 * Windows: native PowerShell script (no Git Bash / pipefail required).
 * Unix: bash run-deliverable-gate.sh
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const full = args.includes("--full");
const skipTests = args.includes("--skip-tests");

if (process.platform === "win32") {
  const psArgs = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(__dirname, "run-deliverable-gate.ps1"),
  ];
  if (full) psArgs.push("-Full");
  if (skipTests) psArgs.push("-SkipTests");

  const result = spawnSync("pwsh", psArgs, { stdio: "inherit", shell: false });
  process.exit(result.status ?? 1);
}

const bashArgs = [path.join(__dirname, "run-deliverable-gate.sh"), ...args];
const result = spawnSync("bash", bashArgs, { stdio: "inherit", shell: false });
process.exit(result.status ?? 1);
