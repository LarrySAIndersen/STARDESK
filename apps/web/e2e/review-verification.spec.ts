/**
 * Playwright spec for Review verification smoke tests.
 *
 * Prefer Work Board integration via repo scripts (manifest + canvas import):
 *   node STARDESK/scripts/run-review-playwright.mjs --task <n>
 *
 * Run this file directly only for ad-hoc debugging:
 *   cd apps/web && npx playwright test e2e/review-verification.spec.ts
 *
 * Requires @playwright/test in apps/web or from STARDESK/scripts.
 */
import { test, expect } from "@playwright/test";

const baseUrl =
  process.env.STARDESK_WEB_URL ?? "https://web-seven-neon-6bvmcoel7n.vercel.app";
const email = process.env.TEST_USER_EMAIL ?? "sf01@example.dk";
const password = process.env.TEST_USER_PASSWORD ?? "";
const targetUrl = process.env.REVIEW_VERIFICATION_URL ?? baseUrl;

test.describe("Review verification smoke", () => {
  test.skip(!password, "Set TEST_USER_PASSWORD for prototype login");

  test("staff login and verification URL loads", async ({ page }) => {
    await page.goto(`${baseUrl.replace(/\/$/, "")}/`);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Log ind" }).click();
    await page.waitForLoadState("networkidle", { timeout: 60_000 });

    const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 200).toBeLessThan(500);
    await expect(page.locator("body")).not.toContainText(/internal server error/i);
  });
});
