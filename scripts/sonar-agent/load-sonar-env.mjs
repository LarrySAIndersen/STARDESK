import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.join(__dirname, ".env");

function parseSimpleEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return {};
  }

  const content = readFileSync(envPath, "utf8");
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex < 1) {
      continue;
    }
    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

/** Load gitignored scripts/sonar-agent/.env; process env wins if already set. */
export function loadSonarEnv() {
  const values = parseSimpleEnvFile(ENV_FILE);
  for (const [key, value] of Object.entries(values)) {
    if (value === "" || process.env[key]) {
      continue;
    }
    process.env[key] = value;
  }
  // GitHub Actions secret and some setups use SONAR instead of SONAR_TOKEN.
  if (!process.env.SONAR_TOKEN && process.env.SONAR) {
    process.env.SONAR_TOKEN = process.env.SONAR;
  }
  if (!process.env.SONAR_HOST_URL) {
    process.env.SONAR_HOST_URL = "https://sonarcloud.io";
  }
  if (!process.env.SONAR_PROJECT_KEY) {
    process.env.SONAR_PROJECT_KEY = "LarrySAIndersen_STARDESK";
  }
}
