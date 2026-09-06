import type { BotProfile } from "./types.js";
export type RobotsResult = {
  url: string;
  status: number;
  body: string | null;
  error: string | null;
};
export async function fetchRobots(
  pageUrl: string,
  bot: BotProfile,
  timeoutMs: number,
): Promise<RobotsResult> {
  const url = new URL("/robots.txt", pageUrl).toString(),
    controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": bot === "google" ? "Googlebot" : "Mozilla/5.0" },
    });
    return {
      url,
      status: response.status,
      body: response.ok ? await response.text() : null,
      error: null,
    };
  } catch (error) {
    return {
      url,
      status: 0,
      body: null,
      error: error instanceof Error ? error.message : "Request failed.",
    };
  } finally {
    clearTimeout(timer);
  }
}
