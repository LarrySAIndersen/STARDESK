import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function isLocalHost(baseUrl) {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

export function isProductionLike(baseUrl) {
  const lower = String(baseUrl).toLowerCase();
  return (
    lower.includes("vercel.app") ||
    process.env.APP_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

export function assertDestructiveAllowed(baseUrl) {
  if (isLocalHost(baseUrl)) {
    return;
  }
  if (process.env.ALLOW_DESTRUCTIVE !== "1") {
    console.error(
      "Destructive run blocked: set ALLOW_DESTRUCTIVE=1 for non-local BASE_URL, or use localhost."
    );
    process.exit(2);
  }
  if (isProductionLike(baseUrl)) {
    console.warn(
      "WARNING: production-like BASE_URL detected. Obtain explicit approval before continuing."
    );
  }
}

export function commandExists(command) {
  const probe = process.platform === "win32" ? "where.exe" : "which";
  const run = spawnSync(probe, [command], { stdio: "ignore", shell: false });
  return run.status === 0;
}

export function buildK6EnvArgs(config) {
  const loadTestDir = dirname(fileURLToPath(import.meta.url));
  const usersFile = resolve(
    loadTestDir,
    process.env.LOAD_TEST_USERS_FILE || "load-test-users.json"
  );
  const args = ["-e", `BASE_URL=${config.baseUrl}`, "-e", `LOAD_TEST_USERS_FILE=${usersFile}`];
  if (process.env.ALLOW_DESTRUCTIVE === "1") {
    args.push("-e", "ALLOW_DESTRUCTIVE=1");
  }
  if (process.env.SPIKE_SMOKE === "1") {
    args.push("-e", "SPIKE_SMOKE=1");
  }
  if (process.env.AGGRESSIVE_SMOKE === "1") {
    args.push("-e", "AGGRESSIVE_SMOKE=1");
  }
  return args;
}

export function runK6Script(scriptName, config, { cwd } = {}) {
  const destructiveDir = resolve(__dirname, "destructive");
  const scriptPath = resolve(destructiveDir, scriptName);
  if (!existsSync(scriptPath)) {
    console.warn(`Skipping missing k6 script: ${scriptPath}`);
    return 0;
  }
  if (!commandExists("k6")) {
    console.error(
      "k6 is not on PATH. Install: winget install GrafanaLabs.k6 (Windows) or see docs/destructive-testing.md"
    );
    return 1;
  }
  console.log("");
  console.log(`=== k6 ${scriptName} ===`);
  const run = spawnSync("k6", ["run", ...buildK6EnvArgs(config), scriptPath], {
    stdio: "inherit",
    env: process.env,
    cwd: cwd || resolve(__dirname, ".."),
  });
  return run.status ?? 1;
}
