import type { BotProfile, FetchResult } from "./types.js";
const agents = {
  google:
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  browser:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
};
export function agentFor(bot: BotProfile) {
  return agents[bot];
}
export async function fetchPage(
  url: string,
  bot: BotProfile,
  timeoutMs: number,
  external?: AbortSignal,
): Promise<FetchResult> {
  const start = performance.now(),
    controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), timeoutMs),
    redirects: string[] = [];
  const relay = () => controller.abort();
  external?.addEventListener("abort", relay, { once: true });
  try {
    let current = url,
      response: Response | undefined;
    for (let hop = 0; hop <= 10; hop++) {
      response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": agents[bot], accept: "text/html" },
      });
      const location = response.headers.get("location");
      if (response.status < 300 || response.status >= 400 || !location) break;
      current = new URL(location, current).toString();
      redirects.push(current);
    }
    if (!response) throw new Error("Empty response.");
    const headers = {
      xRobotsTag: response.headers.get("x-robots-tag"),
      cacheControl: response.headers.get("cache-control"),
      contentLanguage: response.headers.get("content-language"),
      server: response.headers.get("server"),
    };
    return {
      requestedUrl: url,
      finalUrl: response.url || current,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      responseTimeMs: Math.round(performance.now() - start),
      body: await response.text(),
      redirects,
      headers,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error && error.name === "AbortError"
        ? `Timed out after ${timeoutMs}ms.`
        : `Could not fetch ${url}.`,
    );
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", relay);
  }
}

export type LinkProbe = {
  status: number;
  ok: boolean;
  redirected: string | null;
  error: string | null;
};

export async function probeLink(
  url: string,
  bot: BotProfile,
  timeoutMs: number,
  external?: AbortSignal,
): Promise<LinkProbe> {
  const attempt = async (method: "HEAD" | "GET"): Promise<LinkProbe> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const relay = () => controller.abort();
    external?.addEventListener("abort", relay, { once: true });
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": agents[bot], accept: "*/*" },
      });
      return {
        status: response.status,
        ok: response.ok,
        redirected: response.url && response.url !== url ? response.url : null,
        error: null,
      };
    } catch (error) {
      return {
        status: 0,
        ok: false,
        redirected: null,
        error:
          error instanceof Error && error.name === "AbortError"
            ? "timeout"
            : "network error",
      };
    } finally {
      clearTimeout(timer);
      external?.removeEventListener("abort", relay);
    }
  };
  const head = await attempt("HEAD");
  // Some servers reject HEAD with 403/405; confirm with GET before reporting a break.
  if (!head.ok && [403, 405, 501, 0].includes(head.status))
    return attempt("GET");
  return head;
}
