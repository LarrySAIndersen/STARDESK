/**
 * Shared helpers for Sonar jssecurity rules (S5145 logging, S8476 fetch URLs).
 */

const WORKBOARD_CANVAS_ID_RE = /^t-\d{1,8}$/i;
const TASK_NUMBER_RE = /^\d{1,8}$/;
const API_BASE_URL_RE = /^https?:\/\/[a-z0-9][-a-z0-9.]*(?::\d{1,5})?$/i;

/** Safe label for CLI logging (no raw user-controlled strings). */
export function formatSafeLogLabel(value) {
  if (value == null || value === "") return "(unset)";
  const s = String(value).trim();
  if (TASK_NUMBER_RE.test(s)) return `task#${s}`;
  if (WORKBOARD_CANVAS_ID_RE.test(s)) return s;
  return "[redacted]";
}

export function logScript(message) {
  console.log(message);
}

export function logScriptError(code, detail) {
  if (detail) {
    console.error(`[${code}] ${detail}`);
  } else {
    console.error(`[${code}]`);
  }
}

export function failWithCode(code) {
  logScriptError(code);
  process.exit(1);
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
