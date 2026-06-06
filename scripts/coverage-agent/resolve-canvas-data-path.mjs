import fs from "node:fs";
import path from "node:path";

const CANVAS_FILE = "stardesk-coverage-agent.canvas.data.json";

/** Cursor workspace canvas sidecar (preferred) + legacy project path. */
export function resolveCanvasDataPath() {
  if (process.env.COVERAGE_CANVAS_DATA_PATH) {
    return process.env.COVERAGE_CANVAS_DATA_PATH;
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
    path.join(home, ".cursor", "projects", "c-Users-kjaer-STARDESK-Cursor", "canvases", CANVAS_FILE),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}
