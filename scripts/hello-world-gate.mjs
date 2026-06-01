#!/usr/bin/env node
/**
 * UI hello-world gate: login (Anna) → Alle sager → demo tickets visible.
 *
 * Env:
 *   STARDESK_WEB_URL     default http://localhost:3000
 *   TEST_USER_EMAIL      default sf01@example.dk
 *   TEST_USER_PASSWORD   required (prototype demo — see demo.py / demo-users.ts)
 *   GATE_ARTIFACT_DIR    default artifacts/hello-world-gate
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { requirePrototypeDemoPassword } from "./lib/prototype-demo-password.mjs";

const webUrl = (process.env.STARDESK_WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
const email = process.env.TEST_USER_EMAIL ?? "sf01@example.dk";
const password = requirePrototypeDemoPassword();
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

  const vercelBypass = process.env.VERCEL_PROTECTION_BYPASS?.trim();
  if (vercelBypass && /\.vercel\.app$/i.test(new URL(webUrl).hostname)) {
    const bypassUrl = new URL(webUrl);
    bypassUrl.searchParams.set("x-vercel-set-bypass-cookie", "true");
    bypassUrl.searchParams.set("x-vercel-protection-bypass", vercelBypass);
    await page.goto(bypassUrl.toString(), { waitUntil: "domcontentloaded", timeout: 60_000 });
    pass("Vercel deployment protection bypass cookie set");
  }

  await page.goto(`${webUrl}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, "01-login.png") });

  const annaRow = page.getByRole("row", { name: new RegExp(email.replace(".", "\\."), "i") });
  const emailField = page.locator("#email");

  if (await annaRow.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await annaRow.getByRole("button", { name: "Log ind" }).click();
    pass("Demo picker quick login");
  } else if (await emailField.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await emailField.fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Log ind" }).first().click();
    pass("Email/password login");
  } else if (await page.getByText(/alle sager/i).isVisible({ timeout: 3_000 }).catch(() => false)) {
    pass("Already authenticated — skipping login");
  } else {
    await page.goto(`${webUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await emailField.waitFor({ state: "visible", timeout: 30_000 });
    await emailField.fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Log ind" }).first().click();
    pass("Email/password login via /login");
  }

  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});

  const banner = page.getByRole("status");
  const bannerText = (await banner.textContent().catch(() => "")) ?? "";
  if (
    bannerText &&
    /produktion/i.test(bannerText) &&
    !/ikke (?:live )?produktion/i.test(bannerText)
  ) {
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
