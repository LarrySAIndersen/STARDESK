/**
 * Shared helpers for Sonar jssecurity rules (S5145 logging, S8476 fetch URLs, S4036 PATH).
 */
import { spawnSync } from "node:child_process";

const WORKBOARD_CANVAS_ID_RE = /^t-\d{1,8}$/i;
const PATH_PROBE = process.platform === "win32" ? "where.exe" : "which";
const TASK_NUMBER_RE = /^\d{1,8}$/;
const API_BASE_URL_RE = /^https?:\/\/[a-z0-9][-a-z0-9.]*(?::\d{1,5})?$/i;

/**
 * Resolve the first absolute path for a command on PATH (Sonar javascript:S4036).
 * Use the returned path as spawnSync/execSync executable instead of a bare name.
 */
export function resolveCommandPath(command) {
  const run = spawnSync(PATH_PROBE, [command], {
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (run.status !== 0 || !run.stdout?.trim()) return null;
  const first = run.stdout.trim().split(/\r?\n/)[0]?.trim();
  return first || null;
}

/** Safe label for CLI logging (no raw user-controlled strings). */
export function formatSafeLogLabel(value) {
  if (value == null || value === "") return "(unset)";
  const s = String(value).trim();
  if (TASK_NUMBER_RE.test(s)) return `task#${s}`;
  if (WORKBOARD_CANVAS_ID_RE.test(s)) return s;
  return "[redacted]";
}

/** Log a static script event code (no user- or API-controlled text). */
export function logScriptCode(code) {
  const safe = String(code ?? "").replace(/[^A-Z0-9_]/g, "");
  console.log(`[${safe || "SCRIPT"}]`);
}

/** Log a pre-sanitized CLI line (callers must not pass raw API/argv text). */
export function logScript(message) {
  console.log(sanitizeCliLogLine(String(message ?? "")));
}

function sanitizeCliLogLine(line) {
  const segments = line.split(/(\btask#\d{1,8}\b|\bt-\d{1,8}\b|\(unset\)|\[redacted\])/g);
  return segments
    .map((part, index) => {
      if (index % 2 === 1) return part;
      return part.replace(/[^\n\r\t !"#$%&'()*+,\-./0-9:;<=>?@[\]^_`{|}~A-Za-z«»]/g, "?");
    })
    .join("")
    .slice(0, 800);
}

export function logScriptError(code, detail) {
  const safeCode = String(code ?? "ERROR").replace(/[^A-Z0-9_]/g, "") || "ERROR";
  if (detail) {
    const safeDetail = String(detail).replace(/[^0-9A-Za-z _./:-]/g, "");
    console.error(`[${safeCode}] ${safeDetail}`);
  } else {
    console.error(`[${safeCode}]`);
  }
}

export function failWithCode(code, detail) {
  logScriptError(code, detail);
  process.exit(1);
}

/** Run async script main with uniform crash handling (reduces duplicated catch blocks). */
export async function runScriptMain(fn) {
  try {
    await fn();
  } catch {
    logScriptError("SCRIPT_CRASH");
    process.exit(1);
  }
}

/** Validate workboard task id before embedding in request URL path. */
export function assertWorkboardCanvasId(canvasId) {
  const id = String(canvasId ?? "").trim();
  if (!WORKBOARD_CANVAS_ID_RE.test(id)) {
    throw new Error("Invalid workboard task id.");
  }
  return id;
}

/** Validate API base URL from environment (not user argv). */
export function assertConfiguredApiBaseUrl(apiUrl) {
  const base = String(apiUrl ?? "").trim().replace(/\/$/, "");
  if (!API_BASE_URL_RE.test(base)) {
    throw new Error("Invalid STARDESK_API_URL.");
  }
  return base;
}
