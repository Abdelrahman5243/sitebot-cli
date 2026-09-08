import { fetchPage } from "./http.js";
import { parsePage } from "./parser.js";
import { evaluateSeo } from "./seo.js";
import { runPool } from "./pool.js";
import { evaluateRobots } from "./robots.js";
import type { BotProfile, CheckStatus } from "./types.js";

export type CrawledPage = {
  url: string;
  status: number;
  title: string | null;
  description: string | null;
  canonical: string | null;
  h1: string | null;
  wordCount: number;
  score: number;
  worstStatus: CheckStatus;
  error: string | null;
};

export type DuplicateGroup = { value: string; urls: string[] };

export type CrawlReport = {
  pages: CrawledPage[];
  skipped: string[];
  stoppedEarly: boolean;
  duplicateTitles: DuplicateGroup[];
  duplicateDescriptions: DuplicateGroup[];
  missingTitles: string[];
  missingDescriptions: string[];
  averageScore: number;
};

export type CrawlOptions = {
  bot: BotProfile;
  timeoutMs: number;
  limit: number;
  concurrency: number;
  delayMs: number;
  robotsBody: string | null;
  signal: AbortSignal;
  onPage?: (done: number, total: number, url: string) => void;
};

export async function crawlSite(
  urls: string[],
  options: CrawlOptions,
): Promise<CrawlReport> {
  const allowed: string[] = [];
  const skipped: string[] = [];

  for (const url of urls) {
    if (isAllowed(url, options)) allowed.push(url);
    else skipped.push(url);
  }

  const targets = allowed.slice(0, options.limit);
  let done = 0;

  const pages = await runPool(
    targets,
    {
      limit: options.concurrency,
      delayMs: options.delayMs,
      signal: options.signal,
    },
    async (url) => {
      const page = await auditOne(url, options);
      options.onPage?.(++done, targets.length, url);
      return page;
    },
  );

  return summarize(pages, skipped, options.signal.aborted);
}

function isAllowed(url: string, options: CrawlOptions): boolean {
  if (!options.robotsBody) return true;
  return (
    evaluateRobots(options.robotsBody, url, options.bot).status !== "disallowed"
  );
}

async function auditOne(
  url: string,
  options: CrawlOptions,
): Promise<CrawledPage> {
  try {
    const page = await fetchPage(
      url,
      options.bot,
      options.timeoutMs,
      options.signal,
    );
    const meta = parsePage(page.body, page.finalUrl);
    const seo = evaluateSeo(meta);
    return {
      url,
      status: page.status,
      title: meta.title,
      description: meta.description,
      canonical: meta.canonical,
      h1: meta.h1s[0] ?? null,
      wordCount: meta.wordCount,
      score: seo.score,
      worstStatus: worstOf(seo.checks.map((check) => check.status)),
      error: null,
    };
  } catch (error) {
    return {
      url,
      status: 0,
      title: null,
      description: null,
      canonical: null,
      h1: null,
      wordCount: 0,
      score: 0,
      worstStatus: "error",
      error: error instanceof Error ? error.message : "Request failed.",
    };
  }
}

function summarize(
  pages: CrawledPage[],
  skipped: string[],
  stoppedEarly: boolean,
): CrawlReport {
  const ok = pages.filter((page) => !page.error);
  const total = ok.reduce((sum, page) => sum + page.score, 0);
  return {
    pages: pages.sort((a, b) => a.url.localeCompare(b.url)),
    skipped,
    stoppedEarly,
    duplicateTitles: findDuplicates(pages, (page) => page.title),
    duplicateDescriptions: findDuplicates(pages, (page) => page.description),
    missingTitles: pages
      .filter((page) => !page.error && !page.title)
      .map((p) => p.url),
    missingDescriptions: pages
      .filter((page) => !page.error && !page.description)
      .map((page) => page.url),
    averageScore: ok.length ? Math.round(total / ok.length) : 0,
  };
}

function findDuplicates(
  pages: CrawledPage[],
  pick: (page: CrawledPage) => string | null,
): DuplicateGroup[] {
  const groups = new Map<string, string[]>();
  for (const page of pages) {
    const value = pick(page);
    if (!value) continue;
    const urls = groups.get(value) ?? [];
    urls.push(page.url);
    groups.set(value, urls);
  }
  return [...groups]
    .filter(([, urls]) => urls.length > 1)
    .map(([value, urls]) => ({ value, urls }))
    .sort((a, b) => b.urls.length - a.urls.length);
}

function worstOf(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes("error")) return "error";
  if (statuses.includes("warning")) return "warning";
  return "pass";
}
