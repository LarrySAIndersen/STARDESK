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

/** Repo-local default; override with validated PERF_CANVAS_DATA_PATH for Cursor workspace sidecar. */
export function resolveCanvasDataPath() {
  if (process.env.PERF_CANVAS_DATA_PATH) {
    return assertSafeCanvasDataPath(process.env.PERF_CANVAS_DATA_PATH);
  }
  return path.join(REPO_ROOT, "reports", CANVAS_FILE);
}
