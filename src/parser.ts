import { load } from 'cheerio';
import type { Metadata } from './types.js';

export function parsePage(html: string, baseUrl: string): Metadata {
  const $ = load(html);
  const canonical = $('link[rel="canonical"]').first().attr('href') ?? null;
  const openGraph: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  const jsonLd: string[] = [];
  $('meta[property^="og:"]').each((_, element) => {
    const key = $(element).attr('property');
    const value = $(element).attr('content')?.trim();
    if (key && value) openGraph[key] = value;
  });
  $('meta[name^="twitter:"]').each((_, element) => {
    const key = $(element).attr('name');
    const value = $(element).attr('content')?.trim();
    if (key && value) twitter[key] = value;
  });
  $('script[type="application/ld+json"]').each((_, element) => { try { const data = JSON.parse($(element).text()); const types = Array.isArray(data) ? data : [data]; types.forEach((x) => x?.['@type'] && jsonLd.push(String(x['@type']))); } catch { /* invalid JSON-LD */ } });
  const text = cleanText($('body').text());

  return {
    title: cleanText($('title').first().text()) || null,
    description: $('meta[name="description"]').first().attr('content')?.trim() || null,
    canonical: canonical ? new URL(canonical, baseUrl).toString() : null,
    robots: $('meta[name="robots"]').first().attr('content')?.trim() || null,
    h1Count: $('h1').length,
    h1s: $('h1').map((_, element) => cleanText($(element).text())).get().filter(Boolean),
    openGraph,
    twitter,
    lang: $('html').attr('lang') ?? null,
    viewport: $('meta[name="viewport"]').length > 0,
    hreflang: $('link[rel="alternate"][hreflang]').map((_, e) => $(e).attr('hreflang') ?? '').get().filter(Boolean),
    wordCount: text ? text.split(/\s+/).length : 0,
    imageCount: $('img').length,
    imagesWithAlt: $('img[alt]').length,
    jsonLd,
  };
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
