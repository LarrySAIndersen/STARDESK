#!/usr/bin/env node
/**
 * UI hello-world gate: login (Anna) → Alle sager → demo tickets visible.
 *
 * Env:
 *   STARDESK_WEB_URL     default http://localhost:3000
 *   TEST_USER_EMAIL      default sf01@example.dk
 *   TEST_USER_PASSWORD   default Stardesk2026!
 *   GATE_ARTIFACT_DIR    default artifacts/hello-world-gate
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const webUrl = (process.env.STARDESK_WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
const email = process.env.TEST_USER_EMAIL ?? "sf01@example.dk";
const password = process.env.TEST_USER_PASSWORD ?? "Stardesk2026!";
const artifactRoot = process.env.GATE_ARTIFACT_DIR ?? "artifacts/hello-world-gate";

function fail(msg) {
  console.error(`GATE FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`GATE OK: ${msg}`);
}

const outDir = path.resolve(artifactRoot, new Date().toISOString().replace(/[:.]/g, "-"));
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: process.env.PLAYWRIGHT_HEADED !== "1",
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

try {
  console.log(`==> Hello-world gate (UI) — ${webUrl}`);

  await page.goto(`${webUrl}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.screenshot({ path: path.join(outDir, "01-login.png") });

  const demoQuickLogin = page.getByRole("button", { name: "Log ind" }).filter({ hasText: /^Log ind$/ });
  const annaRow = page.getByRole("row", { name: new RegExp(email.replace(".", "\\."), "i") });

  if (await annaRow.isVisible().catch(() => false)) {
    await annaRow.getByRole("button", { name: "Log ind" }).click();
    pass("Demo picker quick login");
  } else {
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Log ind" }).first().click();
    pass("Email/password login");
  }

  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});

  const banner = page.getByRole("status");
  const bannerText = (await banner.textContent().catch(() => "")) ?? "";
  if (bannerText && /produktion/i.test(bannerText) && !/ikke produktion/i.test(bannerText)) {
    fail(`Environment banner looks like production: ${bannerText.slice(0, 80)}`);
  }
  if (bannerText) {
    pass(`Environment banner: ${bannerText.trim().slice(0, 60)}…`);
  }

  await page.screenshot({ path: path.join(outDir, "02-after-login.png") });

  await page.goto(`${webUrl}/tickets`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, "03-alle-sager.png"), fullPage: true });

  const body = await page.locator("body").innerText();
  if (!/alle sager/i.test(body)) {
    fail('Expected "Alle sager" on /tickets');
  }
  pass('Page contains "Alle sager"');

  const hasDemoTicket =
    /DEMO-\d+/i.test(body) ||
    /SF Operations/i.test(body) ||
    /Virksomhed/i.test(body) ||
    /Jobflow/i.test(body);
  if (!hasDemoTicket) {
    fail("No demo ticket labels found (DEMO-*, SF Operations, …). Bootstrap database?");
  }
  pass("Demo tickets visible");

  console.log(`GATE PASSED (UI hello-world) — artifacts: ${outDir}`);
} catch (err) {
  await page.screenshot({ path: path.join(outDir, "99-failure.png"), fullPage: true }).catch(() => {});
  fail(err instanceof Error ? err.message : String(err));
} finally {
  await context.close();
  await browser.close();
}
