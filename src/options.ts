import { cancel, confirm, isCancel, multiselect, select, text } from "@clack/prompts";
import { UsageError, parseFailOn, parseMinScore, type FailOn } from "./gate.js";
import type { Env } from "./env.js";
import type { BotProfile } from "./types.js";

export type Options = {
  url: string;
  /** Which section the user asked for; "full" shows everything. */
  focus: string;
  bot: BotProfile;
  timeoutMs: number;
  json: boolean;
  quiet: boolean;
  color: boolean;
  crawl: boolean;
  limit: number;
  concurrency: number;
  checkLinks: boolean;
  externalLinks: boolean;
  render: boolean;
  vitals: boolean;
  schema: boolean;
  failOn: FailOn;
  minScore: number | null;
  maxSeconds: number;
  pages: string | null;
};

export type RawOptions = {
  bot: string;
  timeout: string;
  json?: boolean;
  quiet?: boolean;
  color?: boolean;
  pages?: string;
  render?: boolean;
  crawl?: boolean;
  limit: string;
  concurrency: string;
  links?: boolean;
  externalLinks?: boolean;
  vitals?: boolean;
  schema?: boolean;
  failOn: string;
  minScore?: string;
  maxSeconds: string;
  yes?: boolean;
};

/** Hard ceilings that protect the target site regardless of user input. */
export const LIMITS = {
  maxPages: 500,
  maxConcurrency: 10,
  maxSeconds: 900,
  linkBudget: 250,
};

export class Cancelled extends Error {}

export async function resolveOptions(
  url: string | undefined,
  raw: RawOptions,
  env: Env,
): Promise<Options> {
  const base = fromFlags(url, raw, env);
  if (!env.interactive) {
    if (!base.url) throw new UsageError("A URL is required. Run with a URL or use an interactive terminal.");
    return base as Options;
  }
  return askWizard(base, raw, env);
}

function fromFlags(url: string | undefined, raw: RawOptions, env: Env) {
  const timeoutSeconds = Number(raw.timeout);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0)
    throw new UsageError("--timeout must be a positive number of seconds.");

  return {
    focus: "full",
    url: url ? normalizeUrl(url) : "",
    bot: parseBot(raw.bot),
    timeoutMs: timeoutSeconds * 1000,
    json: Boolean(raw.json),
    quiet: Boolean(raw.quiet),
    color: env.color,
    crawl: Boolean(raw.crawl),
    limit: clamp(raw.limit, "--limit", 1, LIMITS.maxPages),
    concurrency: clamp(raw.concurrency, "--concurrency", 1, LIMITS.maxConcurrency),
    checkLinks: Boolean(raw.links),
    externalLinks: Boolean(raw.externalLinks),
    render: Boolean(raw.render || raw.vitals),
    vitals: Boolean(raw.vitals),
    schema: raw.schema !== false,
    failOn: parseFailOn(raw.failOn),
    minScore: parseMinScore(raw.minScore),
    maxSeconds: clamp(raw.maxSeconds, "--max-seconds", 5, LIMITS.maxSeconds),
    pages: raw.pages ?? null,
  };
}

async function askWizard(
  base: ReturnType<typeof fromFlags>,
  raw: RawOptions,
  env: Env,
): Promise<Options> {
  const url = base.url || (await askUrl());

  // Any flag beyond the URL means the user knows what they want: run it as
  // given rather than interrupting with a menu. Gate flags count too, since
  // they only appear in scripted use.
  const chose =
    raw.crawl ||
    raw.links ||
    raw.externalLinks ||
    raw.vitals ||
    raw.render ||
    raw.schema === false ||
    raw.pages ||
    raw.minScore !== undefined ||
    raw.failOn !== "error" ||
    raw.yes;
  if (chose) return { ...base, url };

  const focus = await askFocus();
  const all = focus === "full";
  const options: Options = {
    ...base,
    url,
    focus,
    crawl: all || focus === "crawl",
    checkLinks: all || focus === "links",
    vitals: all || focus === "vitals",
    render: all || focus === "vitals",
    schema: all || focus === "schema",
  };

  if (options.crawl) {
    options.limit = await askLimit();
    options.concurrency = await askConcurrency();
  }
  if (options.checkLinks) {
    options.externalLinks = await askYesNo(
      "Also check links pointing to other domains?",
      false,
    );
  }
  return options;
}

async function askUrl(): Promise<string> {
  const answer = await text({
    message: "Which site should sitebot inspect?",
    placeholder: "https://example.com",
    validate: (value) => validateUrl(String(value)) ?? undefined,
  });
  return normalizeUrl(String(unwrap(answer)));
}

async function askFocus(): Promise<string> {
  const answer = await select({
    message: "What should we check?",
    options: [
      { value: "full", label: "Full report", hint: "everything below" },
      { value: "basic", label: "Page basics", hint: "metadata, SEO, GEO" },
      { value: "schema", label: "Structured data", hint: "rich-result fields" },
      { value: "links", label: "Broken links", hint: "every link on the page" },
      { value: "crawl", label: "Crawl from sitemap", hint: "finds duplicates" },
      { value: "vitals", label: "Core Web Vitals", hint: "needs Chromium" },
    ],
    initialValue: "full",
  });
  return unwrap(answer) as string;
}

async function askLimit(): Promise<number> {
  const answer = await select({
    message: "How many pages at most?",
    options: [
      { value: 25, label: "25 pages", hint: "quick" },
      { value: 50, label: "50 pages" },
      { value: 100, label: "100 pages", hint: "recommended" },
      { value: 250, label: "250 pages", hint: "slower" },
    ],
    initialValue: 100,
  });
  return unwrap(answer) as number;
}

async function askConcurrency(): Promise<number> {
  const answer = await select({
    message: "How hard should we hit the server?",
    options: [
      { value: 2, label: "Gentle", hint: "2 at a time" },
      { value: 5, label: "Normal", hint: "5 at a time" },
      { value: 8, label: "Fast", hint: "8 at a time, only for sites you own" },
    ],
    initialValue: 5,
  });
  return unwrap(answer) as number;
}

export async function askYesNo(message: string, initialValue: boolean): Promise<boolean> {
  const answer = await confirm({ message, initialValue });
  return unwrap(answer) as boolean;
}

function unwrap<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Cancelled.");
    throw new Cancelled();
  }
  return value as T;
}

export function validateUrl(value: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ["http:", "https:"].includes(url.protocol) ? null : "Use http:// or https://.";
  } catch {
    return "Please enter a valid URL.";
  }
}

export function normalizeUrl(value: string): string {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const error = validateUrl(withScheme);
  if (error) throw new UsageError(error);
  return new URL(withScheme).toString();
}

function parseBot(value: string): BotProfile {
  if (value !== "google" && value !== "browser")
    throw new UsageError("--bot must be google or browser.");
  return value;
}

function clamp(value: string, flag: string, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max)
    throw new UsageError(`${flag} must be a whole number between ${min} and ${max}.`);
  return parsed;
}
