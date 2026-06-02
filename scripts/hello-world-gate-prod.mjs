#!/usr/bin/env node
/**
 * Production hello-world smoke (post release): login → Alle sager → tickets visible.
 * Not the standard deliverable gate (which rejects production targets).
 *
 * Env:
 *   STARDESK_WEB_URL  default https://web-seven-neon-6bvmcoel7n.vercel.app
 *   STARDESK_API_URL  default https://api-gamma-amber.vercel.app
 *   TEST_USER_EMAIL   API smoke user (default sf01@example.dk)
 *   TEST_USER_UI_EMAIL  UI session user (default sf02@example.dk — admin for /tickets)
 *   TEST_USER_PASSWORD  prototype demo password
 *   GATE_ARTIFACT_DIR default artifacts/hello-world-gate-prod
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { requirePrototypeDemoPassword } from "./lib/prototype-demo-password.mjs";

const webUrl = (
  process.env.STARDESK_WEB_URL ?? "https://web-seven-neon-6bvmcoel7n.vercel.app"
).replace(/\/$/, "");
const apiUrl = (
  process.env.STARDESK_API_URL ?? "https://api-gamma-amber.vercel.app"
).replace(/\/$/, "");
const apiEmail = process.env.TEST_USER_EMAIL ?? "sf01@example.dk";
const uiEmail = process.env.TEST_USER_UI_EMAIL ?? process.env.TEST_USER_EMAIL ?? "sf02@example.dk";
const password = requirePrototypeDemoPassword();
const artifactRoot = process.env.GATE_ARTIFACT_DIR ?? "artifacts/hello-world-gate-prod";

function fail(msg) {
  console.error(`PROD GATE FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`PROD GATE OK: ${msg}`);
}

async function apiCheck(loginEmail) {
  const healthRes = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(30_000) });
  if (!healthRes.ok) fail(`GET /health → ${healthRes.status}`);
  const health = await healthRes.json();
  if (health.stardesk_env !== "production") {
    fail(`Expected stardesk_env=production, got ${health.stardesk_env}`);
  }
  pass(`API health: stardesk_env=production deployment=${health.deployment ?? "—"}`);

  const loginRes = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: loginEmail, password }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!loginRes.ok) fail(`POST login → ${loginRes.status}`);
  const login = await loginRes.json();
  if (!login.access_token) fail("No access_token from login");
  pass(`API login as ${loginEmail}`);

  const ticketsRes = await fetch(`${apiUrl}/api/v1/tickets?page=1&page_size=5`, {
    headers: { Authorization: `Bearer ${login.access_token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!ticketsRes.ok) fail(`GET tickets → ${ticketsRes.status}`);
  const tickets = await ticketsRes.json();
  const count = Array.isArray(tickets) ? tickets.length : (tickets.items?.length ?? 0);
  if (count < 1) fail("API returned no tickets");
  pass(`API tickets listed (count=${count})`);
}

const outDir = path.resolve(artifactRoot, new Date().toISOString().replace(/[:.]/g, "-"));
fs.mkdirSync(outDir, { recursive: true });

console.log(`==> Production hello-world — API ${apiUrl}`);
await apiCheck(apiEmail);

console.log(`==> Production hello-world (UI) — ${webUrl}`);
const browser = await chromium.launch({
  headless: process.env.PLAYWRIGHT_HEADED !== "1",
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

try {
  await page.goto(`${webUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, "01-login.png") });

  const bannerText =
    (await page.getByRole("status").textContent().catch(() => "")) ?? "";
  if (!/produktion/i.test(bannerText)) {
    fail(`Expected PRODUKTION banner, got: ${bannerText.slice(0, 80)}`);
  }
  pass(`Environment banner: ${bannerText.trim().slice(0, 60)}…`);

  const bffLogin = await page.request.post(`${webUrl}/api/auth/login`, {
    data: { email: uiEmail, password },
    headers: { Accept: "application/json" },
  });
  if (!bffLogin.ok()) {
    const detail = await bffLogin.text().catch(() => "");
    fail(`Web BFF login failed (${bffLogin.status()}): ${detail.slice(0, 120)}`);
  }
  pass(`Web BFF login as ${uiEmail} (session cookie)`);

  await page.goto(`${webUrl}/tickets`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
  await page.screenshot({ path: path.join(outDir, "02-after-login.png") });

  for (const route of ["/tickets", "/service-desk"]) {
    await page.goto(`${webUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(2000);
    const body = await page.locator("body").innerText();
    const url = page.url();
    const hasAlleSager =
      /alle sager/i.test(body) ||
      (await page.getByRole("heading", { name: /alle sager/i }).isVisible().catch(() => false));
    const hasTicket =
      /INC-\d{4}-\d+/i.test(body) ||
      /DEMO-\d+/i.test(body) ||
      /SF Operations/i.test(body) ||
      /Virksomhed/i.test(body);
    if (hasAlleSager || hasTicket) {
      pass(`Ticket list OK at ${route} (url=${url})`);
      await page.screenshot({ path: path.join(outDir, "03-alle-sager.png"), fullPage: true });
      if (hasAlleSager) pass('Found "Alle sager"');
      if (hasTicket) pass("Tickets visible (INC-/DEMO-/team labels)");
      break;
    }
    if (route === "/service-desk") {
      console.error("Body snippet:", body.slice(0, 400).replace(/\s+/g, " "));
      fail('No "Alle sager" or tickets on /tickets or /service-desk');
    }
  }

  console.log(`PROD GATE PASSED (API + UI) — artifacts: ${outDir}`);
} catch (err) {
  await page.screenshot({ path: path.join(outDir, "99-failure.png"), fullPage: true }).catch(() => {});
  fail(err instanceof Error ? err.message : String(err));
} finally {
  await context.close();
  await browser.close();
}
