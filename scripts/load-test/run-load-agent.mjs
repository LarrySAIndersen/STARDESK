import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const scenarios = ["baseline", "stress", "soak"];
const scriptPath = resolve(process.cwd(), "run-load-test.mjs");

let failed = false;
for (const scenario of scenarios) {
  console.log("");
  console.log(`=== Running ${scenario} ===`);
  const run = spawnSync(process.execPath, [scriptPath, scenario], {
    stdio: "inherit",
    env: process.env,
  });
  if (run.status !== 0) {
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
