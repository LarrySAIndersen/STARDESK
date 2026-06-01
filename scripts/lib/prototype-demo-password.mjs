/**
 * Prototype demo password for gate/load-test scripts — not production secrets.
 * Prefer TEST_USER_PASSWORD; fall back to PROTOTYPE_BOOTSTRAP_PASSWORD / PROTOTYPE_DEMO_PASSWORD.
 * See apps/api/src/star_itsm_api/core/demo.py (single Python source of truth).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ENV_KEYS = [
  "TEST_USER_PASSWORD",
  "PROTOTYPE_BOOTSTRAP_PASSWORD",
  "PROTOTYPE_DEMO_PASSWORD",
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ENV = path.resolve(__dirname, "../../apps/api/.env");

function readApiEnvValue(key) {
  if (!fs.existsSync(API_ENV)) return undefined;
  for (const line of fs.readFileSync(API_ENV, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name !== key) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return undefined;
}

/** @returns {string} */
export function requirePrototypeDemoPassword() {
  for (const key of ENV_KEYS) {
    const value = process.env[key] ?? readApiEnvValue(key);
    if (value) return value;
  }
  throw new Error(
    `Set one of ${ENV_KEYS.join(", ")} for prototype demo login (see apps/api/.env.development.example).`,
  );
}
