#!/usr/bin/env node
/**
 * Full SonarCloud analysis (uploads sources + coverage to SonarCloud).
 * Env: scripts/sonar-agent/.env (SONAR_TOKEN, SONAR_HOST_URL, SONAR_PROJECT_KEY)
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSonarEnv } from "./load-sonar-env.mjs";

loadSonarEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const token = process.env.SONAR_TOKEN;
const host = process.env.SONAR_HOST_URL ?? "https://sonarcloud.io";
const projectKey = process.env.SONAR_PROJECT_KEY;
const organization = process.env.SONAR_ORGANIZATION;

if (!token) {
  console.error("SONAR_TOKEN missing — set scripts/sonar-agent/.env");
  process.exit(1);
}
if (!projectKey) {
  console.error("SONAR_PROJECT_KEY missing — set scripts/sonar-agent/.env");
  process.exit(1);
}

console.log(`==> SonarCloud full scan: ${projectKey}`);
console.log(`    host: ${host}`);
console.log(`    root: ${REPO_ROOT}`);

const args = [
  "--yes",
  "@sonar/scan",
  `-Dsonar.host.url=${host}`,
  `-Dsonar.token=${token}`,
  `-Dsonar.projectKey=${projectKey}`,
];
if (organization) {
  args.push(`-Dsonar.organization=${organization}`);
}

const result = spawnSync("npx", args, {
  cwd: REPO_ROOT,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
