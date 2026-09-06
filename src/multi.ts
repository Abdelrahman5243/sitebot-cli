import { fetchPage } from './http.js';
import { parsePage } from './parser.js';
import type { BotProfile } from './types.js';
export type PageAudit = { url: string; status: number; title: string | null; wordCount: number; error?: string };
export async function auditPages(base: string, paths: string, bot: BotProfile, timeoutMs: number): Promise<PageAudit[]> {
  const items = paths.split(',').map((x) => x.trim()).filter(Boolean);
  return Promise.all(items.map(async (path) => {
    const url = new URL(path, base).toString();
    try { const page = await fetchPage(url, bot, timeoutMs); const meta = parsePage(page.body, page.finalUrl); return { url, status: page.status, title: meta.title, wordCount: meta.wordCount }; }
    catch (error) { return { url, status: 0, title: null, wordCount: 0, error: error instanceof Error ? error.message : 'failed' }; }
  }));
}
