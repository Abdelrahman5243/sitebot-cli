import type { BotProfile, FetchResult } from './types.js';
const agents = { google: 'Mozilla/5.0 (compatible; Googlebot/2.1)', browser: 'Mozilla/5.0 Chrome/131 Safari/537.36' };
export async function fetchPage(url: string, bot: BotProfile, timeoutMs: number): Promise<FetchResult> {
  const start = performance.now(), controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs), redirects: string[] = [];
  try { let current = url, response: Response | undefined;
    for (let hop = 0; hop <= 10; hop++) { response = await fetch(current, { redirect: 'manual', signal: controller.signal, headers: { 'user-agent': agents[bot], accept: 'text/html' } }); const location = response.headers.get('location'); if (response.status < 300 || response.status >= 400 || !location) break; current = new URL(location, current).toString(); redirects.push(current); }
    if (!response) throw new Error('Empty response.');
    return { requestedUrl: url, finalUrl: response.url || current, status: response.status, statusText: response.statusText, contentType: response.headers.get('content-type'), responseTimeMs: Math.round(performance.now() - start), body: await response.text(), redirects, headers: { xRobotsTag: response.headers.get('x-robots-tag'), cacheControl: response.headers.get('cache-control'), contentLanguage: response.headers.get('content-language'), server: response.headers.get('server') } };
  } catch (error) { throw new Error(error instanceof Error && error.name === 'AbortError' ? `Timed out after ${timeoutMs}ms.` : `Could not fetch ${url}.`); } finally { clearTimeout(timer); }
}
