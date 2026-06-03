import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CANVAS_FILE = "stardesk-performance-agent.canvas.data.json";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

function isPathUnderRoot(candidate, root) {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const rel = path.relative(resolvedRoot, resolvedCandidate);
  return rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

function assertSafeCanvasDataPath(envPath) {
  const resolved = path.resolve(envPath);
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const allowedRoots = [
    path.join(home, ".cursor", "projects"),
    path.join(REPO_ROOT, "reports"),
    path.join(REPO_ROOT, "workboard"),
  ];

  if (!allowedRoots.some((root) => isPathUnderRoot(resolved, root))) {
    throw new Error("PERF_CANVAS_DATA_PATH must be under .cursor/projects, reports/, or workboard/");
  }
  return resolved;
}

/** Cursor workspace canvas sidecar (preferred); repo reports/ fallback for CI/VM. */
export function resolveCanvasDataPath() {
  if (process.env.PERF_CANVAS_DATA_PATH) {
    return assertSafeCanvasDataPath(process.env.PERF_CANVAS_DATA_PATH);
  }

  const home = process.env.USERPROFILE || process.env.HOME || "";
  const candidates = [
    path.join(
      home,
      ".cursor",
      "projects",
      "c-Users-kjaer-cursor-projects-c-Users-kjaer-STARDESK-Cursor-canvases",
      CANVAS_FILE,
    ),
    path.join(
      home,
      ".cursor",
      "projects",
      "c-Users-kjaer-STARDESK-Cursor",
      "canvases",
      CANVAS_FILE,
    ),
    path.join(REPO_ROOT, "reports", CANVAS_FILE),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.join(REPO_ROOT, "reports", CANVAS_FILE);
}
