import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.mjs";
import {
  assertDestructiveAllowed,
  commandExists,
  runK6Script,
} from "./k6-runner.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const k6Scripts = ["spike.js", "stress-to-failure.js", "auth-flood.js", "payload-bomb.js"];

function runPytestDestructive() {
  console.log("");
  console.log("=== pytest -m destructive ===");
  const apiDir = resolve(repoRoot, "apps/api");
  const run = spawnSync("pytest", ["-m", "destructive", "tests/destructive", "-v"], {
    cwd: apiDir,
    stdio: "inherit",
    env: { ...process.env, ALLOW_DESTRUCTIVE: process.env.ALLOW_DESTRUCTIVE || "1" },
    shell: process.platform === "win32",
  });
  return run.status ?? 1;
}

function main() {
  const config = loadConfig();
  assertDestructiveAllowed(config.baseUrl);

  let failed = false;
  if (commandExists("k6")) {
    for (const script of k6Scripts) {
      const status = runK6Script(script, config);
      if (status !== 0) {
        failed = true;
      }
    }
  } else {
    console.warn(
      "k6 not found on PATH — skipping k6 scenarios. Install: winget install GrafanaLabs.k6"
    );
  }

  const pytestStatus = runPytestDestructive();
  if (pytestStatus !== 0) {
    failed = true;
  }

  process.exit(failed ? 1 : 0);
}

main();
