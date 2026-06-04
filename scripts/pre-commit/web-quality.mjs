#!/usr/bin/env node
/** Pre-commit: apps/web eslint + tsc (kodepraksis #40). Cross-platform (no bash CRLF). */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const webDir = path.join(root, "apps", "web");

if (!fs.existsSync(path.join(webDir, "node_modules"))) {
  console.error("apps/web: run npm ci before pre-commit (node_modules missing)");
  process.exit(1);
}

for (const cmd of ["npm run lint", "npm run typecheck"]) {
  execSync(cmd, { cwd: webDir, stdio: "inherit", env: process.env });
}
