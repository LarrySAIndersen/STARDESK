/**
 * Kundeportal #2 route smoke tests — auth gate without credentials.
 *
 * Middleware redirects unauthenticated protected paths to staff login (`/`).
 * The KP2 layout would send users to `/login/helpdesk` only after a session exists.
 *
 * Run:
 *   cd apps/web && npm run test:e2e -- e2e/kundeportal-2-routes.spec.ts
 */
import { test, expect } from "@playwright/test";

test.describe("Kundeportal #2 auth gate", () => {
  test("unauthenticated visit redirects to staff login", async ({ page }) => {
    await page.goto("/kundeportal-2", {
      waitUntil: "domcontentloaded",
    });

    await expect(page).toHaveURL(/\/?$/);
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("service requests catalog redirects unauthenticated users to staff login", async ({
    page,
  }) => {
    await page.goto("/kundeportal-2/service-requests", {
      waitUntil: "domcontentloaded",
    });

    await expect(page).toHaveURL(/\/?$/);
    await expect(page.getByRole("button", { name: "Log ind" })).toBeVisible();
  });
});
