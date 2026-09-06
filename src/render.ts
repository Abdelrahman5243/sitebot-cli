import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
export type RenderResult = { html: string; finalUrl: string; status: number | null; responseTimeMs: number };
export async function renderPage(url: string, timeoutMs: number): Promise<RenderResult> {
  ensureBrowser();
  const start = performance.now(), browser = await chromium.launch({ headless: true });
  try { const page = await browser.newPage(); const response = await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs }); return { html: await page.content(), finalUrl: page.url(), status: response?.status() ?? null, responseTimeMs: Math.round(performance.now() - start) }; }
  finally { await browser.close(); }
}
function ensureBrowser() { if (existsSync(chromium.executablePath())) return; console.log('First render: installing Chromium...'); execFileSync('npx', ['playwright', 'install', 'chromium'], { stdio: 'inherit' }); }
