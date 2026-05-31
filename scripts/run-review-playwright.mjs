#!/usr/bin/env node
/**
 * Playwright smoke verification for Work Board Review tasks (scope stardesk).
 *
 * Env:
 *   TEST_USER_EMAIL     — default sf01@example.dk (prototype admin)
 *   TEST_USER_PASSWORD  — required (prototype: same as DEMO_PASSWORD in apps/web)
 *   STARDESK_WEB_URL    — default https://web-seven-neon-6bvmcoel7n.vercel.app
 *   WORKBOARD_DATA_PATH — canvas.data.json (optional with --export-from-api)
 *   STARDESK_API_URL + STARDESK_API_TOKEN — when --export-from-api
 *
 * Usage:
 *   node scripts/run-review-playwright.mjs --task 54
 *   node scripts/run-review-playwright.mjs --url https://.../aktiver --task-id t-54
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { fetchTasksFromApi } from "./lib/workboard-api.mjs";
import {
  findTaskByNumber,
  readWorkboardTasks,
  resolveReviewEvidenceDir,
  resolveWorkboardDataPath,
} from "./lib/workboard-paths.mjs";
import {
  failWithCode,
  formatSafeLogLabel,
  logScript,
  logScriptError,
} from "./lib/script-security.mjs";

const DEFAULT_WEB_URL = "https://web-seven-neon-6bvmcoel7n.vercel.app";
const DEFAULT_EMAIL = "sf01@example.dk";

function fail(code) {
  failWithCode(code);
}

function parseArgs(argv) {
  const out = {
    taskNumber: null,
    taskId: null,
    url: null,
    username: null,
    password: null,
    exportFromApi: false,
    headless: true,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--export-from-api") {
      out.exportFromApi = true;
      continue;
    }
    if (arg === "--headed") {
      out.headless = false;
      continue;
    }
    const next = argv[i + 1];
    if ((arg === "--task" || arg === "--task-number") && next) {
      out.taskNumber = next;
      i += 1;
      continue;
    }
    if (arg === "--task-id" && next) {
      out.taskId = next;
      i += 1;
      continue;
    }
    if (arg === "--url" && next) {
      out.url = next;
      i += 1;
      continue;
    }
    if ((arg === "--username" || arg === "--email") && next) {
      out.username = next;
      i += 1;
      continue;
    }
    if (arg === "--password" && next) {
      out.password = next;
      i += 1;
      continue;
    }
  }
  return out;
}

async function loadTaskContext(args) {
  let tasks = [];
  let task = null;

  if (args.exportFromApi) {
    tasks = await fetchTasksFromApi();
  } else {
    const dataPath = resolveWorkboardDataPath();
    if (!fs.existsSync(dataPath)) fail("WORKBOARD_DATA_NOT_FOUND");
    ({ tasks } = readWorkboardTasks(dataPath));
  }

  if (args.taskNumber != null) {
    task = findTaskByNumber(tasks, args.taskNumber);
    if (!task) fail("TASK_NOT_FOUND");
  } else if (args.taskId) {
    task = tasks.find((t) => t.id === args.taskId) ?? null;
    if (!task) fail("TASK_NOT_FOUND");
  }

  const verificationUrl =
    args.url?.trim() ||
    task?.reviewVerificationUrl?.trim() ||
    null;
  if (!verificationUrl) {
    fail("MISSING_VERIFICATION_URL");
  }

  const taskId = task?.id ?? args.taskId ?? `manual-${Date.now()}`;
  const taskNumber = task?.number ?? args.taskNumber ?? "0";

  return { task, taskId, taskNumber, verificationUrl, tasks };
}

function pushLog(lines, line) {
  lines.push(`[${new Date().toISOString()}] ${line}`);
  console.log(line);
}

async function captureStep(page, dir, id, caption, lines, screenshots) {
  const fileName = `${id}.png`;
  const filePath = path.join(dir, fileName);
  await page.screenshot({ path: filePath, fullPage: false });
  screenshots.push({ id, caption, file: fileName });
  pushLog(lines, `Screenshot: ${caption}`);
}

async function runVerification({
  baseUrl,
  verificationUrl,
  email,
  password,
  outDir,
}) {
  const lines = [];
  const screenshots = [];
  let status = "passed";
  const browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADED === "1" ? false : true,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    pushLog(lines, `Open login: ${baseUrl}/`);
    await page.goto(`${baseUrl.replace(/\/$/, "")}/`, { waitUntil: "domcontentloaded" });
    await captureStep(page, outDir, "01-login-page", "Login-side", lines, screenshots);

    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Log ind" }).click();
    await page.waitForLoadState("networkidle", { timeout: 60_000 });
    const stillOnLogin = await page
      .getByRole("button", { name: "Log ind" })
      .isVisible()
      .catch(() => false);
    if (stillOnLogin) {
      throw new Error("Login failed — Log ind button still visible");
    }
    pushLog(lines, "Login OK");
    await captureStep(page, outDir, "02-after-login", "Efter login", lines, screenshots);

    pushLog(lines, `Navigate: ${verificationUrl}`);
    const response = await page.goto(verificationUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const httpStatus = response?.status() ?? 0;
    if (httpStatus >= 500) {
      status = "failed";
      pushLog(lines, `HTTP ${httpStatus} on verification URL`);
    } else {
      pushLog(lines, `HTTP ${httpStatus || "ok"}`);
    }
    await captureStep(page, outDir, "03-verification-page", "Verifikations-side", lines, screenshots);

    const bodyText = (await page.locator("body").innerText()).slice(0, 2000);
    if (/internal server error|something went wrong|fejl 500/i.test(bodyText)) {
      status = "failed";
      pushLog(lines, "Page body indicates server error");
    }

    const navLink = page.getByRole("link").first();
    if (await navLink.isVisible().catch(() => false)) {
      const href = await navLink.getAttribute("href");
      if (href && !href.startsWith("javascript")) {
        pushLog(lines, `Smoke click: first link (${href})`);
        await navLink.click({ timeout: 5000 }).catch(() => {
          pushLog(lines, "Link click skipped (non-fatal)");
        });
        await page.waitForTimeout(800);
        await captureStep(page, outDir, "04-after-nav-click", "Efter navigation (smoke)", lines, screenshots);
      }
    }

    const primaryButton = page.getByRole("button").filter({ hasNotText: /log ud|log ind/i }).first();
    if (await primaryButton.isVisible().catch(() => false)) {
      pushLog(lines, "Smoke click: first non-auth button");
      await primaryButton.click({ timeout: 5000 }).catch(() => {
        pushLog(lines, "Button click skipped (non-fatal)");
      });
      await page.waitForTimeout(800);
      await captureStep(page, outDir, "05-after-button-click", "Efter knap (smoke)", lines, screenshots);
    }

    await context.close();
  } catch (err) {
    status = "failed";
    const message = err instanceof Error ? err.message : String(err);
    pushLog(lines, `Playwright error: ${message}`);
    const failShot = path.join(outDir, "99-error.png");
    try {
      const pages = browser.contexts().flatMap((c) => c.pages());
      const page = pages[0];
      if (page) await page.screenshot({ path: failShot, fullPage: false });
      screenshots.push({ id: "99-error", caption: "Fejl", file: "99-error.png" });
    } catch {
      /* ignore */
    }
  } finally {
    await browser.close();
  }

  return { status, log: lines.join("\n"), screenshots };
}

async function main() {
  const args = parseArgs(process.argv);
  const email = args.username || process.env.TEST_USER_EMAIL || DEFAULT_EMAIL;
  const password = args.password || process.env.TEST_USER_PASSWORD || "";
  if (!password) {
    fail("MISSING_TEST_PASSWORD");
  }

  const { task, taskId, taskNumber, verificationUrl } = await loadTaskContext(args);
  const baseUrl = (process.env.STARDESK_WEB_URL || DEFAULT_WEB_URL).replace(/\/$/, "");
  const outDir = resolveReviewEvidenceDir(String(taskId));
  fs.mkdirSync(outDir, { recursive: true });

  const { status, log, screenshots } = await runVerification({
    baseUrl,
    verificationUrl,
    email,
    password,
    outDir,
  });

  const manifest = {
    taskId,
    taskNumber: Number(taskNumber),
    status,
    username: email,
    verificationUrl,
    log,
    screenshots,
    at: Date.now(),
    actor: "agent",
  };

  const manifestPath = path.join(outDir, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  logScript(`\nWrote manifest (${status})`);
  logScript(
    `Import: node scripts/import-playwright-evidence-to-workboard.mjs --task ${formatSafeLogLabel(taskNumber)}`,
  );
  process.exit(status === "passed" ? 0 : 1);
}

main().catch(() => {
  logScriptError("RUN_REVIEW_PLAYWRIGHT_FAILED");
  process.exit(1);
});
