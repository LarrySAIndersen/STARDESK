import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

function getRaw(key, envFileValues, fallback) {
  const fromProcess = process.env[key];
  if (fromProcess !== undefined && fromProcess !== "") {
    return fromProcess;
  }
  const fromFile = envFileValues[key];
  if (fromFile !== undefined && fromFile !== "") {
    return fromFile;
  }
  return fallback;
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

function toFloat(value, fallback) {
  const parsed = Number.parseFloat(String(value));
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function resolveUserPool(envFileValues, loadTestDir) {
  const inlineJson = getRaw("LOAD_TEST_USERS", envFileValues, "");
  if (inlineJson) {
    const parsed = JSON.parse(inlineJson);
    if (!Array.isArray(parsed)) {
      throw new Error("LOAD_TEST_USERS must be a JSON array");
    }
    return parsed;
  }

  const usersFileRaw = getRaw("LOAD_TEST_USERS_FILE", envFileValues, "load-test-users.json");
  const usersFilePath = resolve(loadTestDir, usersFileRaw);
  if (!existsSync(usersFilePath)) {
    throw new Error(
      `User pool file not found at ${usersFilePath}. Create it from load-test-users.example.json or set LOAD_TEST_USERS.`
    );
  }

  const parsed = JSON.parse(readFileSync(usersFilePath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("User pool JSON file must contain an array");
  }
  return parsed;
}

export function loadConfig() {
  const loadTestDir = dirname(fileURLToPath(import.meta.url));
  const envFilePath = resolve(loadTestDir, ".env.loadtest");
  const envFileValues = parseSimpleEnvFile(envFilePath);

  const baseUrl = normalizeBaseUrl(
    getRaw("BASE_URL", envFileValues, getRaw("NEXT_PUBLIC_API_URL", envFileValues, "http://localhost:8000"))
  );
  const webUrl = normalizeBaseUrl(getRaw("WEB_URL", envFileValues, ""));

  const userPoolRaw = resolveUserPool(envFileValues, loadTestDir);
  const users = userPoolRaw
    .filter((item) => item && item.email && item.password)
    .map((item) => ({
      email: String(item.email).trim(),
      password: String(item.password),
      label: item.label ? String(item.label) : undefined,
    }));

  if (users.length === 0) {
    throw new Error("No valid users configured. Provide at least one email/password.");
  }

  return {
    baseUrl,
    webUrl,
    optionalHealthPath: getRaw("HEALTH_PATH", envFileValues, "/health"),
    ticketsPath: getRaw("TICKETS_PATH", envFileValues, "/api/v1/tickets"),
    dashboardPath: getRaw("DASHBOARD_PATH", envFileValues, "/api/v1/reports/dashboard"),
    loginPath: getRaw("LOGIN_PATH", envFileValues, "/api/v1/auth/login"),
    vus: toInt(getRaw("VUS", envFileValues, "20"), 20),
    soakDurationSeconds: toInt(getRaw("SOAK_DURATION_SECONDS", envFileValues, "300"), 300),
    thinkTimeMs: toInt(getRaw("THINK_TIME_MS", envFileValues, "150"), 150),
    stressStages: [
      { durationSeconds: toInt(getRaw("STRESS_STAGE_1_SECONDS", envFileValues, "60"), 60), vus: toInt(getRaw("STRESS_STAGE_1_VUS", envFileValues, "20"), 20) },
      { durationSeconds: toInt(getRaw("STRESS_STAGE_2_SECONDS", envFileValues, "60"), 60), vus: toInt(getRaw("STRESS_STAGE_2_VUS", envFileValues, "40"), 40) },
      { durationSeconds: toInt(getRaw("STRESS_STAGE_3_SECONDS", envFileValues, "30"), 30), vus: toInt(getRaw("STRESS_STAGE_3_VUS", envFileValues, "20"), 20) },
    ],
    thresholds: {
      p95Ms: toFloat(getRaw("THRESHOLD_P95_MS", envFileValues, "2000"), 2000),
      errorRatePct: toFloat(getRaw("THRESHOLD_ERROR_RATE_PCT", envFileValues, "1"), 1),
    },
    users,
  };
}
