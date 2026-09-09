import { gunzipSync } from "node:zlib";
import type { BotProfile } from "./types.js";
import { agentFor } from "./http.js";

export type SitemapResult = {
  urls: string[];
  sources: string[];
  errors: string[];
};

const MAX_INDEX_DEPTH = 3;
const MAX_SITEMAPS = 25;

export async function collectSitemapUrls(
  base: string,
  bot: BotProfile,
  timeoutMs: number,
  robotsBody: string | null,
  cap: number,
): Promise<SitemapResult> {
  const queue = candidates(base, robotsBody);
  const seenSitemaps = new Set<string>();
  const urls = new Set<string>();
  const sources: string[] = [];
  const errors: string[] = [];
  const origin = new URL(base).origin;

  for (let depth = 0; depth < MAX_INDEX_DEPTH && queue.length; depth++) {
    const batch = queue.splice(0, queue.length);
    for (const target of batch) {
      if (seenSitemaps.size >= MAX_SITEMAPS || urls.size >= cap) break;
      if (seenSitemaps.has(target)) continue;
      seenSitemaps.add(target);
      const xml = await fetchXml(target, bot, timeoutMs);
      if (!xml) {
        errors.push(target);
        continue;
      }
      sources.push(target);
      const nested = extract(xml, "sitemap");
      for (const child of nested) {
        if (sameOrigin(child, origin)) queue.push(child);
      }
      for (const loc of extract(xml, "url")) {
        if (urls.size >= cap) break;
        if (sameOrigin(loc, origin)) urls.add(normalize(loc));
      }
    }
  }
  return { urls: [...urls], sources, errors };
}

function candidates(base: string, robotsBody: string | null): string[] {
  const list = new Set<string>();
  for (const line of (robotsBody ?? "").split(/\r?\n/)) {
    const match = /^\s*sitemap\s*:\s*(\S+)/i.exec(line.split("#")[0]);
    if (match) {
      try {
        list.add(new URL(match[1], base).toString());
      } catch {
        /* skip malformed sitemap directive */
      }
    }
  }
  list.add(new URL("/sitemap.xml", base).toString());
  list.add(new URL("/sitemap_index.xml", base).toString());
  return [...list];
}

async function fetchXml(
  url: string,
  bot: BotProfile,
  timeoutMs: number,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": agentFor(bot),
        accept: "application/xml,text/xml,*/*",
      },
    });
    if (!response.ok) return null;
    if (url.endsWith(".gz")) {
      const buffer = Buffer.from(await response.arrayBuffer());
      return gunzipSync(buffer).toString("utf8");
    }
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extract(xml: string, wrapper: "url" | "sitemap"): string[] {
  const found: string[] = [];
  const blocks =
    xml.match(new RegExp(`<${wrapper}[\\s>][\\s\\S]*?</${wrapper}>`, "gi")) ??
    [];
  for (const block of blocks) {
    const loc = /<loc>\s*([\s\S]*?)\s*<\/loc>/i.exec(block);
    if (loc) found.push(decode(loc[1].trim()));
  }
  return found;
}

function decode(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function sameOrigin(candidate: string, origin: string): boolean {
  try {
    return new URL(candidate).origin === origin;
  } catch {
    return false;
  }
}

function normalize(value: string): string {
  const url = new URL(value);
  url.hash = "";
  return url.toString();
}
