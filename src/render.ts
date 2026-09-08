import { chromium, type Page } from "playwright";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { OBSERVER_SCRIPT, readVitals, type Vitals } from "./vitals.js";

export type RenderResult = {
  html: string;
  finalUrl: string;
  status: number | null;
  responseTimeMs: number;
  vitals: Vitals | null;
  consoleErrors: string[];
};

export function hasBrowser() {
  return existsSync(chromium.executablePath());
}

export function installBrowser() {
  execFileSync("npx", ["playwright", "install", "chromium"], { stdio: "inherit" });
}

export async function renderPage(
  url: string,
  timeoutMs: number,
  collectVitals: boolean,
): Promise<RenderResult> {
  const start = performance.now();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const consoleErrors: string[] = [];
    const traffic = { requestCount: 0, transferBytes: 0 };

    page.on("console", (message) => {
      if (message.type() === "error" && consoleErrors.length < 10)
        consoleErrors.push(message.text().slice(0, 200));
    });
    page.on("response", async (response) => {
      traffic.requestCount++;
      const length = Number(response.headers()["content-length"]);
      if (Number.isFinite(length)) traffic.transferBytes += length;
    });

    if (collectVitals) await page.addInitScript(OBSERVER_SCRIPT);

    // `load` rather than `networkidle`: sites with polling or analytics never
    // go idle, and a timeout there would lose the whole measurement.
    const response = await page.goto(url, { waitUntil: "load", timeout: timeoutMs });
    if (collectVitals) await settle(page, timeoutMs);
    const vitals = collectVitals ? await readVitals(page, traffic) : null;

    return {
      html: await page.content(),
      finalUrl: page.url(),
      status: response?.status() ?? null,
      responseTimeMs: Math.round(performance.now() - start),
      vitals,
      consoleErrors,
    };
  } finally {
    await browser.close();
  }
}

/** Gives late LCP candidates and layout shifts a brief window to land. */
async function settle(page: Page, timeoutMs: number) {
  const budget = Math.min(3000, Math.max(1000, timeoutMs / 4));
  await page.waitForLoadState("networkidle", { timeout: budget }).catch(() => {});
  await page.waitForTimeout(500);
}
