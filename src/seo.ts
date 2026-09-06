import type { Metadata, SeoCheck, SeoReport } from './types.js';
export function evaluateSeo(m: Metadata): SeoReport {
  const checks = [length('title', 'Title', m.title, 30, 60), length('description', 'Description', m.description, 50, 160), present('canonical', 'Canonical', m.canonical), h1(m.h1Count), present('og:title', 'Open Graph title', m.openGraph['og:title']), present('og:description', 'Open Graph description', m.openGraph['og:description']), present('og:image', 'Open Graph image', m.openGraph['og:image']), present('twitter:card', 'Twitter card', m.twitter['twitter:card'])];
  return { checks, score: Math.round(checks.filter((x) => x.status === 'pass').length / checks.length * 100) };
}
const pass = (key: string, label: string, message: string): SeoCheck => ({ key, label, status: 'pass', message });
const fail = (key: string, label: string, message: string, status: 'warning' | 'error'): SeoCheck => ({ key, label, status, message });
function present(key: string, label: string, value: string | null): SeoCheck { return value ? pass(key, label, 'Tag is present.') : fail(key, label, 'Tag is missing.', 'warning'); }
function h1(count: number): SeoCheck { return count === 1 ? pass('h1', 'H1', 'Exactly one H1 found.') : fail('h1', 'H1', count ? 'Prefer one H1 heading.' : 'No H1 heading found.', count ? 'warning' : 'error'); }
function length(key: string, label: string, value: string | null, min: number, max: number): SeoCheck {
  if (!value) return fail(key, label, 'Missing.', 'error');
  if (value.length < min) return fail(key, label, `Short (${value.length} characters).`, 'warning');
  if (value.length > max) return fail(key, label, `Long (${value.length} characters).`, 'warning');
  return pass(key, label, `Good length (${value.length} characters).`);
}
