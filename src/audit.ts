import { fetchPage } from "./http.js";
import { fetchRobots } from "./robots-fetcher.js";
import { parsePage } from "./parser.js";
import { evaluateSeo } from "./seo.js";
import { evaluateAiAccess, evaluateRobots } from "./robots.js";
import { checkSite } from "./site-checks.js";
import { auditPages } from "./multi.js";
import { collectSitemapUrls } from "./sitemap.js";
import { crawlSite } from "./crawl.js";
import { checkLinks } from "./links.js";
import { validateSchemas } from "./schema.js";
import { evaluateVitals } from "./vitals.js";
import { renderPage } from "./render.js";
import type { Options } from "./options.js";
import type { Report } from "./types.js";

export type Progress = {
  step: (message: string) => void;
  update: (message: string) => void;
};

export async function runAudit(
  options: Options,
  signal: AbortSignal,
  progress: Progress,
): Promise<Report> {
  progress.step("Fetching page");
  const page = await fetchPage(options.url, options.bot, options.timeoutMs, signal);
  const rawMetadata = parsePage(page.body, page.finalUrl);

  progress.step("Reading robots.txt");
  const robotsTxt = await fetchRobots(page.finalUrl, options.bot, options.timeoutMs);

  const runs = options.render ? await renderAll(options, page.finalUrl, progress) : null;
  // The desktop pass supplies the rendered HTML; both supply vitals.
  const rendered = runs?.desktop ?? runs?.mobile ?? null;
  const metadata = rendered ? parsePage(rendered.html, rendered.finalUrl) : rawMetadata;

  progress.step("Checking site signals");
  const site = await checkSite(page.finalUrl, metadata, options.bot, options.timeoutMs);

  const schema = options.schema ? validateSchemas(metadata.jsonLdRaw) : null;
  const links = options.checkLinks
    ? await runLinkCheck(options, metadata.links, signal, progress)
    : null;
  const crawl = options.crawl
    ? await runCrawl(options, page.finalUrl, robotsTxt.body, signal, progress)
    : null;
  const pages = options.pages
    ? await auditPages(page.finalUrl, options.pages, options.bot, options.timeoutMs)
    : undefined;

  return {
    ...page,
    body: undefined,
    bot: options.bot,
    metadata,
    rawMetadata,
    rendered: rendered && {
      finalUrl: rendered.finalUrl,
      status: rendered.status,
      responseTimeMs: rendered.responseTimeMs,
      htmlSize: rendered.html.length,
      consoleErrors: rendered.consoleErrors,
    },
    vitals: rendered?.vitals ?? null,
    vitalsChecks: rendered?.vitals ? evaluateVitals(rendered.vitals) : null,
    deviceVitals: runs
      ? {
          mobile: runs.mobile?.vitals ?? null,
          desktop: runs.desktop?.vitals ?? null,
        }
      : null,
    seo: evaluateSeo(metadata),
    site,
    schema,
    links,
    crawl,
    pages,
    robotsTxt: { url: robotsTxt.url, status: robotsTxt.status, error: robotsTxt.error },
    robots: evaluateRobots(robotsTxt.body, page.finalUrl, options.bot),
    aiAccess: evaluateAiAccess(robotsTxt.body, page.finalUrl, options.agents),
    cancelled: signal.aborted,
  };
}

async function renderAll(options: Options, url: string, progress: Progress) {
  if (!options.vitals) {
    progress.step("Rendering in Chromium");
    return { mobile: null, desktop: await renderPage(url, options.timeoutMs, false) };
  }
  // Sequential, not parallel: two throttled browsers would skew each other.
  progress.step("Measuring Core Web Vitals (mobile)");
  const mobile = await renderPage(url, options.timeoutMs, true, "mobile");
  progress.step("Measuring Core Web Vitals (desktop)");
  const desktop = await renderPage(url, options.timeoutMs, true, "desktop");
  return { mobile, desktop };
}

async function runLinkCheck(
  options: Options,
  links: Report["metadata"]["links"],
  signal: AbortSignal,
  progress: Progress,
) {
  progress.step("Checking links");
  return checkLinks(links, {
    bot: options.bot,
    timeoutMs: options.timeoutMs,
    max: 250,
    concurrency: options.concurrency,
    delayMs: 0,
    includeExternal: options.externalLinks,
    signal,
    onProgress: (done, total) => progress.update(`Checking links ${done}/${total}`),
  });
}

async function runCrawl(
  options: Options,
  base: string,
  robotsBody: string | null,
  signal: AbortSignal,
  progress: Progress,
) {
  progress.step("Reading sitemap");
  const sitemap = await collectSitemapUrls(
    base,
    options.bot,
    options.timeoutMs,
    robotsBody,
    options.limit,
  );
  if (!sitemap.urls.length) {
    return { sitemap, report: null };
  }

  progress.step(`Crawling ${sitemap.urls.length} pages`);
  const report = await crawlSite(sitemap.urls, {
    bot: options.bot,
    timeoutMs: options.timeoutMs,
    limit: options.limit,
    concurrency: options.concurrency,
    delayMs: crawlDelay(robotsBody),
    robotsBody,
    signal,
    onPage: (done, total) => progress.update(`Crawling ${done}/${total}`),
  });
  return { sitemap, report };
}

/** Honour robots.txt Crawl-delay, capped so a hostile value cannot stall us. */
function crawlDelay(robotsBody: string | null): number {
  const match = /^\s*crawl-delay\s*:\s*([\d.]+)/im.exec(robotsBody ?? "");
  if (!match) return 0;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(seconds, 5) * 1000;
}
