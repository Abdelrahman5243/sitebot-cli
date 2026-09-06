export type RobotsCheck = {
  status: 'allowed' | 'disallowed' | 'unknown';
  matchedRule: string | null;
};

export function evaluateRobots(body: string | null, pageUrl: string, bot: 'google' | 'browser'): RobotsCheck {
  if (!body) return { status: 'unknown', matchedRule: null };

  const path = new URL(pageUrl).pathname + new URL(pageUrl).search;
  const lines = body.split(/\r?\n/).map((line) => line.split('#')[0].trim()).filter(Boolean);
  const rules: Array<{ type: 'allow' | 'disallow'; path: string }> = [];
  let applies = false;
  let hasGroup = false;
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.toLowerCase().trim();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      hasGroup = true;
      applies = value === '*' || (bot === 'google' && /googlebot/i.test(value));
    } else if (applies && (key === 'allow' || key === 'disallow') && value) {
      rules.push({ type: key, path: value });
    }
  }
  if (!hasGroup || rules.length === 0) return { status: 'unknown', matchedRule: null };

  const matches = rules.filter((rule) => path.startsWith(rule.path)).sort((a, b) => b.path.length - a.path.length);
  const rule = matches[0];
  return rule
    ? { status: rule.type === 'allow' ? 'allowed' : 'disallowed', matchedRule: `${rule.type}: ${rule.path}` }
    : { status: 'allowed', matchedRule: null };
}
