import type { CheckStatus } from "./types.js";

export type FailOn = "never" | "error" | "warning";

export const EXIT = {
  ok: 0,
  threshold: 1,
  usage: 2,
  runtime: 3,
  cancelled: 130,
} as const;

export type GateInput = {
  failOn: FailOn;
  minScore: number | null;
  status: number;
  score: number;
  statuses: CheckStatus[];
  brokenLinks: number;
};

export type GateResult = { passed: boolean; reasons: string[] };

export function parseFailOn(value: string): FailOn {
  if (value !== "never" && value !== "error" && value !== "warning")
    throw new UsageError("--fail-on must be never, error, or warning.");
  return value;
}

export function parseMinScore(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100)
    throw new UsageError("--min-score must be between 0 and 100.");
  return n;
}

export function evaluateGate(input: GateInput): GateResult {
  const reasons: string[] = [];
  if (input.status >= 400) reasons.push(`HTTP ${input.status}`);
  if (input.minScore !== null && input.score < input.minScore)
    reasons.push(`score ${input.score} below minimum ${input.minScore}`);
  if (input.failOn !== "never") {
    const errors = input.statuses.filter((s) => s === "error").length;
    if (errors) reasons.push(`${errors} error check${errors === 1 ? "" : "s"}`);
    if (input.failOn === "warning") {
      const warnings = input.statuses.filter((s) => s === "warning").length;
      if (warnings)
        reasons.push(`${warnings} warning${warnings === 1 ? "" : "s"}`);
    }
    if (input.brokenLinks) reasons.push(`${input.brokenLinks} broken links`);
  }
  return { passed: reasons.length === 0, reasons };
}

export class UsageError extends Error {
  readonly exitCode = EXIT.usage;
}
