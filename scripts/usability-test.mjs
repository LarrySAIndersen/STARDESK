/**
 * One-off usability smoke test against deployed STARdesk.
 * Run: node scripts/usability-test.mjs
 */
import { chromium } from "playwright";
import { requirePrototypeDemoPassword } from "./lib/prototype-demo-password.mjs";
import { logScript, logScriptError } from "./lib/script-security.mjs";

const BASE = process.env.STARDESK_WEB_URL ?? "https://web-seven-neon-6bvmcoel7n.vercel.app";
const API = process.env.STARDESK_API_URL ?? "https://api-gamma-amber.vercel.app";
const DEMO_PASSWORD = requirePrototypeDemoPassword();
const LARRY_PASSWORD = process.env.LARRY_DEMO_PASSWORD ?? "password"; // NOSONAR javascript:S2068
const TOKEN_COOKIE = "stardesk_token";
const USER_COOKIE = "stardesk_user";

const USERS = [
  {
    label: "Administrator (fuld adgang)",
    email: "larrysanders@example.dk",
    password: LARRY_PASSWORD,
    staff: true,
  },
  {
    label: "SF Topadmin",
    email: "sf01@example.dk",
    password: DEMO_PASSWORD,
    staff: true,
  },
  {
    label: "Es Trifft agent",
    email: "estrifft01@example.dk",
    password: DEMO_PASSWORD,
    staff: true,
  },
  {
    label: "Self-service indmelder",
    email: "submitter@example.dk",
    password: DEMO_PASSWORD,
    staff: false,
  },
];

/** @typedef {{ step: string, ok: boolean, note?: string }} Finding */

/** @type {Finding[]} */
const findings = [];

function record(step, ok, note) {
  findings.push({ step, ok, note });
  logScript(ok ? "  [PASS]" : "  [FAIL]");
}

async function loginViaApi(context, email, password) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API login ${res.status}: ${detail.slice(0, 120)}`);
  }
  const data = await res.json();
  const host = new URL(BASE).hostname;
  await context.addCookies([
    {
      name: TOKEN_COOKIE,
      value: data.access_token,
      domain: host,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
    {
      name: USER_COOKIE,
      value: JSON.stringify(data.user),
      domain: host,
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax",
    },
  ]);
  return data.user;
}

async function loginViaUi(page, email, password) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const loginHeading = page.getByRole("heading", { name: /Log ind på STARdesk/i });
  if (!(await loginHeading.isVisible().catch(() => false))) {
    return (await page.context().cookies()).some((c) => c.name === TOKEN_COOKIE) ? "ui" : null;
  }
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  try {
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/login"), { timeout: 8000 }),
      page.getByRole("button", { name: /^Log ind$/i }).click(),
    ]);
    if (resp.status() === 200) {
      await page.waitForTimeout(1500);
      if ((await page.context().cookies()).some((c) => c.name === TOKEN_COOKIE)) {
        return "ui";
      }
    }
  } catch {
    /* BFF login unavailable on this deploy */
  }
  return null;
}

async function login(context, page, email, password) {
  const uiOk = await loginViaUi(page, email, password);
  if (uiOk) return { method: "ui" };
  await loginViaApi(context, email, password);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const onLogin = await page.getByRole("heading", { name: /Log ind på STARdesk/i }).isVisible();
  if (onLogin) {
    throw new Error("Session ikke accepteret efter API-login (mulig deploy mismatch)");
  }
  return { method: "api-fallback" };
}

async function logout(page) {
  const menuBtn = page.getByRole("button", { name: /menu|bruger|konto|log ud/i }).first();
  if (await menuBtn.count()) {
    await menuBtn.click().catch(() => {});
  }
  const logout = page.getByRole("menuitem", { name: /Log ud/i });
  if (await logout.count()) {
    await logout.click();
    await page.getByRole("heading", { name: /Log ind/i }).waitFor({ timeout: 15000 }).catch(() => {});
    return;
  }
  await page.context().clearCookies();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
}

async function testUser(browser, user, userIndex) {
  logScript(`\n=== Brugerprofil ${userIndex + 1} ===`);
  const context = await browser.newContext({ locale: "da-DK" });
  const page = await context.newPage();

  try {
    const loginResult = await login(context, page, user.email, user.password);
    record(
      "Login",
      true,
      loginResult.method === "ui" ? undefined : "UI-login fejler (307); session via API",
    );

    const nav = page.getByRole("navigation", { name: /Hovednavigation/i });
    await nav.waitFor();
    record("Hovednavigation synlig", true);

    const sager = nav.getByRole("link", { name: "Sager" });
    record("Link: Sager", await sager.isVisible());

    const opret = nav.getByRole("button", { name: "Opret sag" });
    record("Knap: Opret sag", await opret.isVisible());

    const grupper = nav.getByRole("link", { name: "Grupper" });
    const rapporter = nav.getByRole("link", { name: "Rapporter" });
    const grupperVisible = await grupper.isVisible();
    const rapporterVisible = await rapporter.isVisible();

    if (user.staff) {
      record("Staff: Grupper synlig", grupperVisible, grupperVisible ? undefined : "forventet for agent/admin");
      record("Staff: Rapporter synlig", rapporterVisible, rapporterVisible ? undefined : "forventet for agent/admin");
    } else {
      record("End user: Grupper skjult", !grupperVisible);
      record("End user: Rapporter skjult", !rapporterVisible);
    }

    await opret.click();
    await page.waitForURL(/\/tickets\/new/, { timeout: 15000 });
    const titleField = page.locator('input[name="title"], #title, [aria-label*="Titel"], [placeholder*="titel" i]').first();
    const hasForm =
      (await titleField.count()) > 0 ||
      (await page.getByText(/opret sag|ny sag/i).count()) > 0;
    record("Opret sag-side loader", hasForm, page.url());

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    const mainContent = page.locator("main");
    await mainContent.waitFor();
    const bodyText = (await mainContent.textContent()) ?? "";
    const hasTicketUi =
      /sag|ticket|ingen sager|indlæs/i.test(bodyText) ||
      (await page.locator("table, [role='table'], [data-slot='table']").count()) > 0;
    record("Sager-liste/portal indhold", hasTicketUi);

    if (user.staff && rapporterVisible) {
      await rapporter.click();
      await page.waitForURL(/\/reports/, { timeout: 15000 });
      const reportsHeading = page.getByRole("heading", { name: /Rapporter/i });
      await reportsHeading.waitFor({ timeout: 10000 });
      record("Rapporter-side", true);

      const exportBtn = page.getByRole("button", { name: /Excel|eksporter/i });
      if ((await exportBtn.count()) > 0) {
        record("Excel-eksport knap", true);
      } else {
        record("Excel-eksport knap", false, "ikke fundet på rapporter");
      }
    }

    if (user.staff && grupperVisible) {
      await grupper.click();
      await page.waitForURL(/\/groups/, { timeout: 15000 });
      const groupsOk =
        (await page.getByText(/gruppe/i).count()) > 0 ||
        (await page.locator("table, [role='table']").count()) > 0;
      record("Grupper-side", groupsOk, page.url());
    }

    const skiftPwd = page.getByRole("link", { name: /Skift adgangskode/i });
    if ((await skiftPwd.count()) === 0) {
      await logout(page);
      await page.goto(`${BASE}/skift-adgangskode`, { waitUntil: "domcontentloaded" });
    } else {
      await page.goto(`${BASE}/skift-adgangskode`, { waitUntil: "domcontentloaded" });
    }
    const pwdPage =
      (await page.getByText(/adgangskode/i).count()) > 0 ||
      (await page.locator("form").count()) > 0;
    record("Skift adgangskode-side", pwdPage);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    record("Flow afbrudt", false, msg);
    try {
      await page.screenshot({
        path: `scripts/usability-fail-${user.email.replace("@", "_at_")}.png`,
        fullPage: true,
      });
    } catch {
      /* ignore */
    }
  } finally {
    await context.close();
  }
}

async function testWebBffLogin() {
  logScript("\n=== Web BFF /api/auth/login ===");
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: "sf01@example.dk", password: DEMO_PASSWORD }),
    redirect: "manual",
  });
  const ok = res.status === 200;
  record(
    "POST /api/auth/login returnerer 200",
    ok,
    ok ? undefined : `får ${res.status} → ${res.headers.get("location") ?? "ingen location"}`,
  );
}

async function testLoginPageDemo() {
  logScript("\n=== Login-UI (demo picker) ===");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const demoTable = page.locator("table").first();
    const hasDemo = (await demoTable.count()) > 0;
    record("Demo-brugertabel på login", hasDemo, hasDemo ? "NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true" : "kun manuelt login");

    if (hasDemo) {
      const quickLogin = page.getByRole("button", { name: /Hurtig login|Log ind som/i }).first();
      if ((await quickLogin.count()) > 0) {
        await quickLogin.click();
        await page.getByRole("navigation", { name: /Hovednavigation/i }).waitFor({ timeout: 20000 });
        record("Hurtig login fra demo-tabel", true);
        await page.context().clearCookies();
      }
    }
  } catch (e) {
    record("Login-UI demo", false, e instanceof Error ? e.message : String(e));
  } finally {
    await browser.close();
  }
}

async function checkApiHealth() {
  logScript("\n=== API health ===");
  try {
    const res = await fetch("https://api-gamma-amber.vercel.app/health");
    const ok = res.ok;
    const body = await res.text();
    record("API /health", ok, `${res.status} ${body.slice(0, 80)}`);
  } catch (e) {
    record("API /health", false, e instanceof Error ? e.message : String(e));
  }
}

logScript("STARdesk usability test");
logScript("Starter testkørsel\n");

await checkApiHealth();
await testWebBffLogin();
await testLoginPageDemo();

const browser = await chromium.launch({ headless: true });
for (let i = 0; i < USERS.length; i += 1) {
  await testUser(browser, USERS[i], i);
}
await browser.close();

const passed = findings.filter((f) => f.ok).length;
const failed = findings.filter((f) => !f.ok).length;
logScript(`\n--- Opsummering: ${passed} bestået, ${failed} fejlet (${findings.length} tjek) ---`);
if (failed > 0) {
  logScriptError("usability_failures", `count=${failed}`);
  process.exit(1);
}
