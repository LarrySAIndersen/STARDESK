#!/usr/bin/env node
/**
 * Playwright performance agent — frontend Web Vitals + navigation timing.
 * Maps results to STARDESK-performance-50 UI plan items.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { loadPerfEnv } from "../load-perf-env.mjs";
import {
  DEFAULT_THRESHOLDS,
  UI_SCENARIOS,
  thresholdForUiScenario,
} from "../performance-plan.mjs";
import { requirePrototypeDemoPassword } from "../../lib/prototype-demo-password.mjs";

loadPerfEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const REPORT_JSON = path.join(REPO_ROOT, "reports/performance-playwright-latest.json");
const ARTIFACTS_ROOT = path.join(REPO_ROOT, "artifacts/performance/playwright");
const VIDEOS_DIR = path.join(ARTIFACTS_ROOT, "videos");
const TRACES_DIR = path.join(ARTIFACTS_ROOT, "traces");
const SCREENSHOTS_DIR = path.join(ARTIFACTS_ROOT, "screenshots");

function percentile(sorted, pct) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1),
  );
  return Number(sorted[index].toFixed(2));
}

async function collectWebVitals(page) {
  return page.evaluate(async () => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paints = performance.getEntriesByType("paint");
    const fcp = paints.find((p) => p.name === "first-contentful-paint");

    const lcpPromise = new Promise((resolve) => {
      let lcp = 0;
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) lcp = last.startTime;
        });
        observer.observe({ type: "largest-contentful-paint", buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(lcp);
        }, 2000);
      } catch {
        resolve(0);
      }
    });

    const clsPromise = new Promise((resolve) => {
      let cls = 0;
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) cls += entry.value;
          }
        });
        observer.observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(cls);
        }, 2000);
      } catch {
        resolve(0);
      }
    });

    const [lcp, cls] = await Promise.all([lcpPromise, clsPromise]);
    const resources = performance.getEntriesByType("resource");

    return {
      domContentLoadedMs: nav ? Number(nav.domContentLoadedEventEnd.toFixed(2)) : 0,
      loadEventEndMs: nav ? Number(nav.loadEventEnd.toFixed(2)) : 0,
      ttfbMs: nav ? Number((nav.responseStart - nav.requestStart).toFixed(2)) : 0,
      fcpMs: fcp ? Number(fcp.startTime.toFixed(2)) : 0,
      lcpMs: Number(lcp.toFixed(2)),
      cls: Number(cls.toFixed(4)),
      resourceCount: resources.length,
      transferSizeKb: Number(
        (resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024).toFixed(2),
      ),
    };
  });
}

async function login(context, page, webUrl, email, password) {
  const vercelBypass = process.env.VERCEL_PROTECTION_BYPASS?.trim();
  if (vercelBypass && /\.vercel\.app$/i.test(new URL(webUrl).hostname)) {
    const bypassUrl = new URL(webUrl);
    bypassUrl.searchParams.set("x-vercel-set-bypass-cookie", "true");
    bypassUrl.searchParams.set("x-vercel-protection-bypass", vercelBypass);
    await page.goto(bypassUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60_000 });
  }

  const loginResponse = await context.request.post(`${webUrl}/api/auth/login`, {
    data: { email, password },
    headers: { Accept: "application/json", "Content-Type": "application/json" },
  });
  if (!loginResponse.ok()) {
    const detail = await loginResponse.text().catch(() => "");
    throw new Error(`BFF login failed (${loginResponse.status()}): ${detail.slice(0, 200)}`);
  }

  await page.goto(`${webUrl}/tickets`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1500);
  const body = await page.locator("body").innerText();
  if (!/alle sager/i.test(body)) {
    throw new Error('Login did not reach "Alle sager" on /tickets');
  }
}

function relRepoPath(absPath) {
  return path.relative(REPO_ROOT, absPath).split(path.sep).join("/");
}

async function runScenario(page, webUrl, scenario, { screenshotPath } = {}) {
  const started = Date.now();
  let error = null;
  let vitals = null;

  try {
    await page.goto(`${webUrl}${scenario.webPath}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    if (scenario.waitFor) {
      await page.getByText(new RegExp(scenario.waitFor, "i")).first().waitFor({
        state: "visible",
        timeout: 30_000,
      });
    }

    if (scenario.followFirstTicket) {
      const firstLink = page.locator("table tbody tr a, [data-testid='ticket-row'] a").first();
      if (await firstLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await firstLink.click();
        await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
      }
    }

    await page.waitForTimeout(1500);
    vitals = await collectWebVitals(page);

    if (screenshotPath) {
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
  } catch (err) {
    error = String(err?.message || err);
    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    }
  }

  const wallClockMs = Date.now() - started;
  return {
    id: scenario.id,
    label: scenario.label,
    webPath: scenario.webPath,
    planItems: scenario.planItems,
    wallClockMs,
    vitals,
    error,
    pass: !error && vitals != null,
    screenshot: screenshotPath ? relRepoPath(screenshotPath) : null,
  };
}

function evaluateResults(results) {
  const breaches = [];
  for (const result of results) {
    if (result.error) {
      breaches.push(`${result.id}: ${result.error}`);
      continue;
    }
    const target = thresholdForUiScenario(result.id);
    if (result.wallClockMs > target) {
      breaches.push(`${result.id} wall-clock ${result.wallClockMs}ms > ${target}ms`);
    }
    if (result.vitals?.lcpMs > DEFAULT_THRESHOLDS.ui.lcpMs) {
      breaches.push(
        `${result.id} LCP ${result.vitals.lcpMs}ms > ${DEFAULT_THRESHOLDS.ui.lcpMs}ms`,
      );
    }
    if (result.vitals?.cls > DEFAULT_THRESHOLDS.ui.cls) {
      breaches.push(`${result.id} CLS ${result.vitals.cls} > ${DEFAULT_THRESHOLDS.ui.cls}`);
    }
  }
  return breaches;
}

async function main() {
  const webUrl = (process.env.WEB_URL || process.env.STARDESK_WEB_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const email = process.env.TEST_USER_EMAIL ?? "sf01@example.dk";
  const password = requirePrototypeDemoPassword();
  const iterations = Number.parseInt(process.env.PW_PERF_ITERATIONS ?? "1", 10);

  console.log(`=== Playwright perf agent ===`);
  console.log(`Target: ${webUrl}`);
  console.log(`Scenarios: ${UI_SCENARIOS.length}, iterations: ${iterations}`);

  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  fs.mkdirSync(TRACES_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADED !== "1",
  });

  const loginContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const loginPage = await loginContext.newPage();
  await login(loginContext, loginPage, webUrl, email, password);
  const storageState = await loginContext.storageState();
  await loginContext.close();

  const allRuns = [];
  const artifactVideos = [];
  const artifactTraces = [];
  const artifactScreenshots = [];
  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");

  try {
    for (let i = 0; i < iterations; i += 1) {
      for (const scenario of UI_SCENARIOS) {
        console.log(`  → ${scenario.label} (${scenario.webPath})`);

        const slug = `${scenario.id}-iter${i + 1}-${runStamp}`;
        const tracePath = path.join(TRACES_DIR, `${slug}.zip`);
        const screenshotPath = path.join(SCREENSHOTS_DIR, `${slug}.png`);

        const context = await browser.newContext({
          viewport: { width: 1280, height: 800 },
          storageState,
          recordVideo: { dir: VIDEOS_DIR },
        });
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
        const page = await context.newPage();

        const result = await runScenario(page, webUrl, scenario, { screenshotPath });
        allRuns.push({ iteration: i + 1, ...result });

        await context.tracing.stop({ path: tracePath });
        artifactTraces.push(relRepoPath(tracePath));
        if (result.screenshot) artifactScreenshots.push(result.screenshot);

        const video = page.video();
        await context.close();
        if (video) {
          const savedVideo = await video.path();
          if (savedVideo && fs.existsSync(savedVideo)) {
            artifactVideos.push(relRepoPath(savedVideo));
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  const byScenario = {};
  for (const run of allRuns) {
    if (!byScenario[run.id]) byScenario[run.id] = [];
    byScenario[run.id].push(run);
  }

  const scenarioStats = {};
  for (const [id, runs] of Object.entries(byScenario)) {
    const wallClocks = runs.map((r) => r.wallClockMs).sort((a, b) => a - b);
    const lcps = runs.filter((r) => r.vitals).map((r) => r.vitals.lcpMs).sort((a, b) => a - b);
    const errors = runs.filter((r) => r.error).length;
    scenarioStats[id] = {
      count: runs.length,
      errors,
      wallClockMs: {
        p50: percentile(wallClocks, 50),
        p95: percentile(wallClocks, 95),
      },
      lcpMs: { p50: percentile(lcps, 50), p95: percentile(lcps, 95) },
      thresholdMs: thresholdForUiScenario(id),
      planItems: runs[0]?.planItems ?? [],
    };
  }

  const thresholdBreaches = evaluateResults(allRuns);
  const report = {
    agent: "playwright",
    generatedAt: new Date().toISOString(),
    target: webUrl,
    scenarios: UI_SCENARIOS,
    thresholds: DEFAULT_THRESHOLDS.ui,
    runs: allRuns,
    scenarioStats,
    thresholdBreaches,
    pass: thresholdBreaches.length === 0,
    artifacts: {
      dir: relRepoPath(ARTIFACTS_ROOT),
      videos: artifactVideos,
      traces: artifactTraces,
      screenshots: artifactScreenshots,
    },
  };

  fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");

  console.log("");
  for (const [id, stats] of Object.entries(scenarioStats)) {
    console.log(
      `${id}: wall p95=${stats.wallClockMs.p95}ms, LCP p95=${stats.lcpMs.p95}ms, errors=${stats.errors}`,
    );
  }
  console.log(`Result: ${report.pass ? "PASS" : "FAIL"}`);
  for (const breach of thresholdBreaches.slice(0, 10)) {
    console.log(` - ${breach}`);
  }
  console.log(`Report: ${REPORT_JSON}`);

  process.exit(report.pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(2);
});
