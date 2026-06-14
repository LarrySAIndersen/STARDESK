import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "artifacts", "screenshots");

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto("http://localhost:3000/dev/theme-palette", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const headerShot = path.join(outDir, "theme-palette-header.png");
  const fullShot = path.join(outDir, "theme-palette-full.png");
  await page.locator("header.wire-topheader").screenshot({ path: headerShot });
  await page.screenshot({ path: fullShot, fullPage: true });
  console.log(headerShot);
  console.log(fullShot);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
