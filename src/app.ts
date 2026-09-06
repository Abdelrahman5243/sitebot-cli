import { confirm, intro, isCancel, outro } from "@clack/prompts";
import { getInput, type Options } from "./options.js";
import { fetchPage } from "./http.js";
import { fetchRobots } from "./robots-fetcher.js";
import { parsePage } from "./parser.js";
import { evaluateSeo } from "./seo.js";
import { evaluateRobots } from "./robots.js";
import { printJson, printQuiet, printTerminal } from "./report.js";
import { checkSite } from "./site-checks.js";
import { auditPages } from "./multi.js";
import { hasBrowser, installBrowser, renderPage } from "./render.js";

export async function run(url: string | undefined, raw: RawOptions) {
  const options: Options = {
    bot: raw.bot as Options["bot"],
    timeoutMs: Number(raw.timeout) * 1000,
    json: raw.json,
    quiet: raw.quiet,
    color: raw.color !== false,
  };
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)
    throw new Error("Timeout must be positive.");
  if (!options.json && !options.quiet) intro("sitebot");
  const input = await getInput(url, options.bot);
  if (!input) {
    process.exitCode = 1;
    return;
  }
  const page = await fetchPage(input.url, input.bot, options.timeoutMs);
  if (raw.render && !hasBrowser()) await prepareBrowser();
  const rawMetadata = parsePage(page.body, page.finalUrl),
    rendered = raw.render
      ? await renderPage(page.finalUrl, options.timeoutMs)
      : null;
  const metadata = rendered
    ? parsePage(rendered.html, rendered.finalUrl)
    : rawMetadata;
  const seo = evaluateSeo(metadata),
    robotsTxt = await fetchRobots(page.finalUrl, input.bot, options.timeoutMs);
  const site = await checkSite(
    page.finalUrl,
    metadata,
    input.bot,
    options.timeoutMs,
  );
  const pages = raw.pages
    ? await auditPages(page.finalUrl, raw.pages, input.bot, options.timeoutMs)
    : undefined;
  const report = {
    ...page,
    body: undefined,
    bot: input.bot,
    metadata,
    rawMetadata,
    rendered: rendered
      ? {
          finalUrl: rendered.finalUrl,
          status: rendered.status,
          responseTimeMs: rendered.responseTimeMs,
          htmlSize: rendered.html.length,
        }
      : null,
    seo,
    site,
    pages,
    robotsTxt: {
      url: robotsTxt.url,
      status: robotsTxt.status,
      error: robotsTxt.error,
    },
    robots: evaluateRobots(robotsTxt.body, page.finalUrl, input.bot),
  };
  if (options.json) printJson(report);
  else if (options.quiet) printQuiet(seo.score);
  else {
    printTerminal(report, options.color);
    outro("Fetch complete.");
  }
  if (
    page.status >= 400 ||
    seo.checks.some((check) => check.status === "error")
  )
    process.exitCode = 1;
}
type RawOptions = {
  bot: string;
  timeout: string;
  json?: boolean;
  quiet?: boolean;
  color?: boolean;
  pages?: string;
  render?: boolean;
};
async function prepareBrowser() { const allowed = await askInstall(); if (!allowed) throw new Error('Render cancelled. Choose Yes to install Chromium.'); installBrowser(); }
async function askInstall() { const answer = await confirm({ message: "Chromium is required for --render. Install it now (~200 MB)?", initialValue: true }); return !isCancel(answer) && answer; }
