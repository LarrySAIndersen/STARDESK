#!/usr/bin/env node
/**
 * Fetch Security Hotspots from SonarCloud (for quality gate "Security Hotspots Reviewed").
 *
 * Writes reports/sonar-hotspots-latest.json
 *
 * Env: SONAR_TOKEN (or SONAR), SONAR_HOST_URL, SONAR_PROJECT_KEY — see .env.example
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSonarEnv } from "./load-sonar-env.mjs";

loadSonarEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORT_PATH = path.join(REPO_ROOT, "reports", "sonar-hotspots-latest.json");

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

function shortenComponent(componentKey, projectKey) {
  const prefix = `${projectKey}:`;
  if (componentKey?.startsWith(prefix)) return componentKey.slice(prefix.length);
  return componentKey ?? "";
}

async function sonarGet(baseUrl, token, endpoint, params) {
  const url = new URL(endpoint, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  const auth = Buffer.from(`${token}:`).toString("base64");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Sonar API ${response.status} ${response.statusText}: ${body.slice(0, 300)}`);
  }
  return response.json();
}

async function fetchHotspots(baseUrl, token, projectKey, status, inNewCodePeriod) {
  const all = [];
  const pageSize = 500;
  let pageIndex = 1;
  let total = 0;

  do {
    const payload = await sonarGet(baseUrl, token, "/api/hotspots/search", {
      projectKey,
      status,
      inNewCodePeriod: inNewCodePeriod ? "true" : undefined,
      ps: pageSize,
      p: pageIndex,
    });
    const hotspots = payload.hotspots ?? [];
    total = payload.paging?.total ?? hotspots.length;
    all.push(...hotspots);
    pageIndex += 1;
    if (!hotspots.length) break;
  } while (all.length < total);

  return all;
}

async function main() {
  const baseUrl = requiredEnv("SONAR_HOST_URL");
  const token = requiredEnv("SONAR_TOKEN");
  const projectKey = requiredEnv("SONAR_PROJECT_KEY");
  const inNewCodePeriod = process.env.SONAR_NEW_CODE_ONLY !== "0";
  const status = process.env.SONAR_HOTSPOT_STATUS ?? "TO_REVIEW";

  const raw = await fetchHotspots(baseUrl, token, projectKey, status, inNewCodePeriod);
  const items = raw.map((hotspot) => ({
    key: hotspot.key,
    status: hotspot.status,
    rule: hotspot.ruleKey,
    message: hotspot.message,
    path: shortenComponent(hotspot.component, projectKey),
    line: hotspot.line ?? null,
    vulnerabilityProbability: hotspot.vulnerabilityProbability ?? null,
    securityCategory: hotspot.securityCategory ?? null,
  }));

  const report = {
    fetchedAt: new Date().toISOString(),
    projectKey,
    query: { status, inNewCodePeriod },
    count: items.length,
    items,
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Wrote ${REPORT_PATH}`);
  console.log(`Security hotspots (${status}, new code=${inNewCodePeriod}): ${items.length}`);
  for (const item of items.slice(0, 30)) {
    const where = `${item.path}${item.line ? `:${item.line}` : ""}`;
    console.log(`- ${where} · ${item.rule} · ${item.message}`);
  }
  if (items.length > 30) {
    console.log(`… and ${items.length - 30} more`);
  }
}

main().catch((error) => {
  const report = {
    fetchedAt: new Date().toISOString(),
    error: error.message,
    projectKey: process.env.SONAR_PROJECT_KEY ?? "LarrySAIndersen_STARDESK",
    query: {
      status: process.env.SONAR_HOTSPOT_STATUS ?? "TO_REVIEW",
      inNewCodePeriod: process.env.SONAR_NEW_CODE_ONLY !== "0",
    },
    count: 0,
    items: [],
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.error(`Sonar hotspots fetch failed: ${error.message}`);
  process.exit(1);
});
