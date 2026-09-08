import { probeLink } from "./http.js";
import { runPool } from "./pool.js";
import type { BotProfile, PageLink } from "./types.js";

export type LinkResult = {
  url: string;
  text: string;
  internal: boolean;
  status: number;
  ok: boolean;
  redirected: string | null;
  error: string | null;
};

export type LinkReport = {
  checked: number;
  broken: LinkResult[];
  redirects: LinkResult[];
  internalCount: number;
  externalCount: number;
  truncated: boolean;
};

export type LinkOptions = {
  bot: BotProfile;
  timeoutMs: number;
  max: number;
  concurrency: number;
  delayMs: number;
  includeExternal: boolean;
  signal: AbortSignal;
  onProgress?: (done: number, total: number) => void;
};

export async function checkLinks(
  links: PageLink[],
  options: LinkOptions,
): Promise<LinkReport> {
  const wanted = options.includeExternal
    ? links
    : links.filter((link) => link.internal);
  const targets = wanted.slice(0, options.max);
  let done = 0;

  const results = await runPool(
    targets,
    { limit: options.concurrency, delayMs: options.delayMs, signal: options.signal },
    async (link): Promise<LinkResult> => {
      const probe = await probeLink(link.url, options.bot, options.timeoutMs, options.signal);
      options.onProgress?.(++done, targets.length);
      return { ...link, ...probe };
    },
  );

  return {
    checked: results.length,
    broken: results.filter((result) => !result.ok),
    redirects: results.filter((result) => result.ok && result.redirected),
    internalCount: results.filter((result) => result.internal).length,
    externalCount: results.filter((result) => !result.internal).length,
    truncated: wanted.length > targets.length,
  };
}
