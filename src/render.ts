import { chromium, devices, type Browser, type Page } from "playwright";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { OBSERVER_SCRIPT, readVitals, type Vitals } from "./vitals.js";

export type Device = "mobile" | "desktop";

export type RenderResult = {
  html: string;
  finalUrl: string;
  status: number | null;
  responseTimeMs: number;
  vitals: Vitals | null;
  consoleErrors: string[];
};

/**
 * Lighthouse's mobile profile: a mid-tier phone on 4G. Without the CPU and
 * network throttling a desktop machine reports times no real phone reaches.
 */
const MOBILE_CPU_THROTTLE = 4;
const MOBILE_NETWORK = {
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
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
  device: Device = "desktop",
): Promise<RenderResult> {
  const start = performance.now();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext(
      device === "mobile" ? devices["Pixel 7"] : {},
    );
    const page = await context.newPage();
    if (device === "mobile" && collectVitals) await throttle(page);
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

    // Do not wait for the full `load` event here. Third-party analytics and ad
    // requests can keep it pending even after the document is usable, causing
    // an otherwise valid audit to fail at the per-request timeout. The settle
    // window below still gives late paint candidates time to land for vitals.
    let response: Awaited<ReturnType<Page["goto"]>> = null;
    try {
      response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
    } catch (error) {
      // Some sites never finish navigation because a proxy, consent layer, or
      // third-party request remains open. If Chromium has left about:blank,
      // the document is still useful for parsing and the HTTP pass already
      // provides the authoritative status/content fallback.
      const navigationStarted = page.url() !== "about:blank";
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      if (!timedOut || !navigationStarted) throw error;
      consoleErrors.push(`Navigation timed out after ${timeoutMs}ms.`);
    }
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

/** Applies phone-grade CPU and network limits through the CDP session. */
async function throttle(page: Page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: MOBILE_CPU_THROTTLE });
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    ...MOBILE_NETWORK,
  });
}

/** Gives late LCP candidates and layout shifts a brief window to land. */
async function settle(page: Page, timeoutMs: number) {
  const budget = Math.min(3000, Math.max(1000, timeoutMs / 4));
  await page.waitForLoadState("networkidle", { timeout: budget }).catch(() => {});
  await page.waitForTimeout(500);
}
