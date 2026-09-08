import { load, type CheerioAPI } from "cheerio";
import type { Metadata, PageLink } from "./types.js";
export function parsePage(html: string, baseUrl: string): Metadata {
  const $ = load(html),
    canonical = $('link[rel="canonical"]').first().attr("href") ?? null,
    openGraph: Record<string, string> = {},
    twitter: Record<string, string> = {},
    jsonLd: string[] = [],
    jsonLdRaw: unknown[] = [];
  $('meta[property^="og:"]').each((_, e) => {
    const k = $(e).attr("property"),
      v = $(e).attr("content")?.trim();
    if (k && v) openGraph[k] = v;
  });
  $('meta[name^="twitter:"]').each((_, e) => {
    const k = $(e).attr("name"),
      v = $(e).attr("content")?.trim();
    if (k && v) twitter[k] = v;
  });
  $('script[type="application/ld+json"]').each((_, e) => {
    try {
      const data = JSON.parse($(e).text()),
        list = Array.isArray(data) ? data : [data];
      list.forEach((x) => {
        if (!x) return;
        jsonLdRaw.push(x);
        if (x["@type"]) jsonLd.push(String(x["@type"]));
      });
    } catch {
      /* invalid JSON-LD */
    }
  });
  const text = clean($("body").text());
  const links = collectLinks($, baseUrl);
  return {
    title: clean($("title").first().text()) || null,
    description:
      $('meta[name="description"]').first().attr("content")?.trim() || null,
    canonical: canonical ? new URL(canonical, baseUrl).toString() : null,
    robots: $('meta[name="robots"]').first().attr("content")?.trim() || null,
    h1Count: $("h1").length,
    h1s: $("h1")
      .map((_, e) => clean($(e).text()))
      .get()
      .filter(Boolean),
    openGraph,
    twitter,
    lang: $("html").attr("lang") ?? null,
    viewport: $('meta[name="viewport"]').length > 0,
    hreflang: $('link[rel="alternate"][hreflang]')
      .map((_, e) => $(e).attr("hreflang") ?? "")
      .get()
      .filter(Boolean),
    wordCount: text ? text.split(/\s+/).length : 0,
    imageCount: $("img").length,
    imagesWithAlt: $("img[alt]").length,
    jsonLd,
    jsonLdRaw,
    links,
    clientRendered:
      $("#root").length > 0 && $("#root").text().trim().length === 0,
  };
}

/** Collects unique http(s) link targets, ignoring anchors and mailto/tel. */
function collectLinks($: CheerioAPI, baseUrl: string): PageLink[] {
  const seen = new Map<string, PageLink>();
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href")?.trim();
    if (!href || href.startsWith("#")) return;
    let resolved: URL;
    try {
      resolved = new URL(href, baseUrl);
    } catch {
      return;
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return;
    resolved.hash = "";
    const url = resolved.toString();
    if (seen.has(url)) return;
    seen.set(url, {
      url,
      text: clean($(element).text()).slice(0, 80),
      internal: resolved.origin === new URL(baseUrl).origin,
    });
  });
  return [...seen.values()];
}
function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
