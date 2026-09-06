import type { BotProfile } from './types.js';
export type SiteChecks = { sitemap: Check; llms: Check; hreflang: Check; lang: Check; viewport: Check; content: Check; schemas: string[] };
export type Check = { status: 'pass' | 'warning' | 'error'; message: string };
type Meta = { hreflang: string[]; lang: string | null; viewport: boolean; wordCount: number; imageCount: number; imagesWithAlt: number; jsonLd: string[] };

export async function checkSite(baseUrl: string, meta: Meta, bot: BotProfile, timeoutMs: number): Promise<SiteChecks> {
  const [sitemap, llms] = await Promise.all([resource(baseUrl, '/sitemap.xml', bot, timeoutMs), resource(baseUrl, '/llms.txt', bot, timeoutMs)]);
  return { sitemap: result(sitemap, 'sitemap.xml'), llms: result(llms, 'llms.txt'), hreflang: meta.hreflang.length ? pass(`found (${meta.hreflang.join(', ')})`) : warn('missing'), lang: meta.lang ? pass(meta.lang) : warn('missing'), viewport: meta.viewport ? pass('configured') : warn('missing'), content: contentCheck(meta), schemas: meta.jsonLd };
}
async function resource(base: string, path: string, bot: BotProfile, timeoutMs: number) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); try { const response = await fetch(new URL(path, base), { signal: controller.signal, headers: { 'user-agent': bot === 'google' ? 'Googlebot' : 'Mozilla/5.0' } }); return { ok: response.ok, status: response.status }; } catch { return { ok: false, status: 0 }; } finally { clearTimeout(timer); } }
function result(r: { ok: boolean; status: number }, name: string): Check { if (r.ok) return pass(`found (${r.status})`); if (r.status === 403) return warn(`${name} blocked (403)`); if (r.status === 404) return warn(`${name} missing (404)`); return warn(`${name} unreachable (${r.status || 'network error'})`); }
function contentCheck(m: Meta): Check { if (m.wordCount < 100) return warn(`thin content (${m.wordCount} words)`); if (m.imageCount && m.imagesWithAlt / m.imageCount < .8) return warn(`alt coverage ${Math.round(m.imagesWithAlt / m.imageCount * 100)}%`); return pass(`${m.wordCount} words, alt coverage ${m.imageCount ? Math.round(m.imagesWithAlt / m.imageCount * 100) : 100}%`); }
const pass = (message: string): Check => ({ status: 'pass', message });
const warn = (message: string): Check => ({ status: 'warning', message });
