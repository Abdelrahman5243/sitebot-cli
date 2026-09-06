import { cancel, isCancel, select, text } from "@clack/prompts";
import type { BotProfile } from "./types.js";
export type Options = {
  bot: BotProfile;
  timeoutMs: number;
  json?: boolean;
  quiet?: boolean;
  color: boolean;
};
export function validUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol)
      ? null
      : "Use http:// or https://.";
  } catch {
    return "Please enter a valid URL.";
  }
}
export async function getInput(
  url: string | undefined,
  bot: string,
): Promise<{ url: string; bot: BotProfile } | null> {
  const input =
    url ??
    (await text({
      message: "Which URL should we inspect?",
      placeholder: "https://example.com",
      validate: (v) => validUrl(String(v)) ?? undefined,
    }));
  if (isCancel(input)) {
    cancel("Cancelled.");
    return null;
  }
  const normalized = /^https?:\/\//i.test(String(input))
      ? String(input)
      : `https://${String(input)}`,
    error = validUrl(normalized);
  if (error) {
    cancel(error);
    return null;
  }
  if (url) return { url: normalized, bot: checkedBot(bot) };
  const choice = await select({
    message: "Which bot profile should we use?",
    options: [
      { value: "google", label: "Googlebot" },
      { value: "browser", label: "Browser" },
    ],
    initialValue: bot,
  });
  if (isCancel(choice)) {
    cancel("Cancelled.");
    return null;
  }
  return { url: normalized, bot: checkedBot(String(choice)) };
}
function checkedBot(value: string): BotProfile {
  if (value !== "google" && value !== "browser")
    throw new Error("Bot must be google or browser.");
  return value;
}
