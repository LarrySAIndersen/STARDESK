/**
 * Public route smoke tests — no credentials required.
 *
 * Run:
 *   cd scripts && npx playwright test ../apps/web/e2e/public-routes.spec.ts
 */
import { test, expect } from "@playwright/test";

const baseUrl = process.env.STARDESK_WEB_URL ?? "http://localhost:3000";

test.describe("Public routes smoke", () => {
  test("staff login page renders email and password fields", async ({ page }) => {
    await page.goto(`${baseUrl.replace(/\/$/, "")}/`);
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log ind" })).toBeVisible();
  });

  test("portal landing page loads without server error", async ({ page }) => {
    const response = await page.goto(`${baseUrl.replace(/\/$/, "")}/portal`, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status() ?? 200).toBeLessThan(500);
    await expect(page.locator("body")).not.toContainText(/internal server error/i);
  });
});
