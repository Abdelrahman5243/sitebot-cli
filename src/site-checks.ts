import type { BotProfile, Metadata } from "./types.js";
export type Check = { status: "pass" | "warning" | "error"; message: string };
export type SiteChecks = {
  sitemap: Check;
  llms: Check;
  hreflang: Check;
  lang: Check;
  viewport: Check;
  content: Check;
  schemas: string[];
};
export async function checkSite(
  base: string,
  m: Metadata,
  bot: BotProfile,
  timeoutMs: number,
): Promise<SiteChecks> {
  const [sitemap, llms] = await Promise.all([
    resource(base, "/sitemap.xml", bot, timeoutMs),
    resource(base, "/llms.txt", bot, timeoutMs),
  ]);
  return {
    sitemap: result(sitemap, "sitemap.xml"),
    llms: result(llms, "llms.txt"),
    hreflang: m.hreflang.length
      ? pass(`found (${m.hreflang.join(", ")})`)
      : warn("missing"),
    lang: m.lang ? pass(m.lang) : warn("missing"),
    viewport: m.viewport ? pass("configured") : warn("missing"),
    content: content(m),
    schemas: m.jsonLd,
  };
}
async function resource(
  base: string,
  path: string,
  bot: BotProfile,
  timeoutMs: number,
) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(new URL(path, base), {
      signal: controller.signal,
      headers: { "user-agent": bot === "google" ? "Googlebot" : "Mozilla/5.0" },
    });
    return { ok: r.ok, status: r.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}
function result(r: { ok: boolean; status: number }, name: string): Check {
  if (r.ok) return pass(`found (${r.status})`);
  if (r.status === 403) return warn(`${name} blocked (403)`);
  if (r.status === 404) return warn(`${name} missing (404)`);
  return warn(`${name} unreachable (${r.status || "network error"})`);
}
function content(m: Metadata): Check {
  if (m.clientRendered)
    return warn(`client-rendered shell (${m.wordCount} raw words)`);
  if (m.wordCount < 100) return warn(`thin content (${m.wordCount} words)`);
  const alt = m.imageCount
    ? Math.round((m.imagesWithAlt / m.imageCount) * 100)
    : 100;
  return alt < 80
    ? warn(`alt coverage ${alt}%`)
    : pass(`${m.wordCount} words, alt coverage ${alt}%`);
}
const pass = (message: string): Check => ({ status: "pass", message });
const warn = (message: string): Check => ({ status: "warning", message });
