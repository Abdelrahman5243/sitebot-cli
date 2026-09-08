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
  /** Timed out or refused connection: likely slow, not necessarily broken. */
  unreachable: LinkResult[];
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

  // A timeout is not proof of breakage, so it is reported separately and does
  // not fail the build.
  const failed = results.filter((result) => !result.ok);
  return {
    checked: results.length,
    broken: failed.filter((result) => result.status > 0),
    unreachable: failed.filter((result) => result.status === 0),
    redirects: results.filter((result) => result.ok && result.redirected),
    internalCount: results.filter((result) => result.internal).length,
    externalCount: results.filter((result) => !result.internal).length,
    truncated: wanted.length > targets.length,
  };
}
