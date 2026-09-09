export type RobotsCheck = {
  status: "allowed" | "disallowed" | "unknown";
  matchedRule: string | null;
};

/**
 * The AI crawlers worth reporting on: each name is what the operator publishes
 * for robots.txt, so a site can allow or block them by name.
 */
export const AI_AGENTS = [
  { name: "GPTBot", label: "ChatGPT" },
  { name: "OAI-SearchBot", label: "ChatGPT Search" },
  { name: "ClaudeBot", label: "Claude" },
  { name: "PerplexityBot", label: "Perplexity" },
  { name: "Google-Extended", label: "Gemini / AI Overviews" },
  { name: "CCBot", label: "Common Crawl" },
] as const;

type Rule = { type: "allow" | "disallow"; path: string };

export type AgentAccess = {
  name: string;
  label: string;
  status: RobotsCheck["status"];
};

/**
 * Whether each AI crawler is allowed to fetch the given page. `extra` adds
 * user-agents the built-in list does not cover, such as a newly announced
 * crawler or an internal bot.
 */
export function evaluateAiAccess(
  body: string | null,
  pageUrl: string,
  extra: string[] = [],
): AgentAccess[] {
  const known = AI_AGENTS.map((agent) => ({ name: agent.name, label: agent.label }));
  const custom = extra
    .filter((name) => !known.some((a) => a.name.toLowerCase() === name.toLowerCase()))
    .map((name) => ({ name, label: "custom" }));
  return [...known, ...custom].map((agent) => ({
    ...agent,
    status: evaluateRobots(body, pageUrl, agent.name).status,
  }));
}

export function evaluateRobots(
  body: string | null,
  pageUrl: string,
  bot: string,
): RobotsCheck {
  if (!body) return { status: "unknown", matchedRule: null };

  const path = new URL(pageUrl).pathname + new URL(pageUrl).search;
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.split("#")[0].trim())
    .filter(Boolean);

  // Collect the wildcard group and the named group separately. A group naming
  // this agent wins outright; the wildcard only applies when none does.
  const named: Rule[] = [];
  const wildcard: Rule[] = [];
  let target: Rule[] | null = null;
  let hasGroup = false;

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.toLowerCase().trim();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      hasGroup = true;
      target = value === "*" ? wildcard : matchesAgent(value, bot) ? named : null;
    } else if (target && (key === "allow" || key === "disallow") && value) {
      target.push({ type: key, path: value });
    }
  }
  const rules = named.length ? named : wildcard;

  if (!hasGroup || rules.length === 0)
    return { status: "unknown", matchedRule: null };

  const matches = rules
    .filter((rule) => path.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length);
  const rule = matches[0];
  return rule
    ? {
        status: rule.type === "allow" ? "allowed" : "disallowed",
        matchedRule: `${rule.type}: ${rule.path}`,
      }
    : { status: "allowed", matchedRule: null };
}

/** A group applies to us if it targets everyone or names this agent. */
function matchesAgent(value: string, bot: string): boolean {
  const target = bot === "google" ? "googlebot" : bot === "browser" ? "" : bot;
  if (!target) return false;
  return value.toLowerCase() === target.toLowerCase();
}
