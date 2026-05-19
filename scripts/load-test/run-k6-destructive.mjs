import { loadConfig } from "./config.mjs";
import { assertDestructiveAllowed, runK6Script } from "./k6-runner.mjs";

const argv = process.argv.slice(2);
const smoke = argv.includes("--smoke");
const scriptName = argv.find((a) => a.endsWith(".js"));
if (!scriptName) {
  console.error("Usage: node run-k6-destructive.mjs <script.js> [--smoke]");
  process.exit(2);
}
if (smoke) {
  if (scriptName.includes("spike")) {
    process.env.SPIKE_SMOKE = "1";
  }
  if (scriptName.includes("aggressive")) {
    process.env.AGGRESSIVE_SMOKE = "1";
  }
}

const config = loadConfig();
assertDestructiveAllowed(config.baseUrl);
const status = runK6Script(scriptName, config);
process.exit(status);
