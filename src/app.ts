import { intro, log, outro, spinner } from "@clack/prompts";
import pc from "picocolors";
import { detectEnv } from "./env.js";
import { Cancelled, resolveOptions, askYesNo, type Options, type RawOptions } from "./options.js";
import { EXIT, UsageError, evaluateGate } from "./gate.js";
import { runAudit, type Progress } from "./audit.js";
import { printGate, printJson, printQuiet, printReport } from "./report.js";
import { hasBrowser, installBrowser } from "./render.js";
import type { CheckStatus, Report } from "./types.js";

export async function run(url: string | undefined, raw: RawOptions) {
  const env = detectEnv(raw.color !== false, raw.json, raw.quiet);
  const verbose = !raw.json && !raw.quiet;

  try {
    if (verbose) intro(pc.bgCyan(pc.black(" sitebot ")));
    const options = await resolveOptions(url, raw, env);
    if (options.render) await ensureBrowser(env.interactive, raw.yes);

    const { controller, stop } = watchForCancel(options.maxSeconds);
    const progress = makeProgress(verbose);
    let report: Report;
    try {
      report = await runAudit(options, controller.signal, progress);
    } finally {
      progress.done();
      stop();
    }

    const gate = evaluateGate({
      failOn: options.failOn,
      minScore: options.minScore,
      status: report.status,
      score: scoreFor(report, options.focus),
      // Only judge what was actually reported, so a narrow run cannot fail on
      // checks the user never asked to see.
      statuses: gatedStatuses(report, options.focus),
      brokenLinks: report.links?.broken.length ?? 0,
      incomplete: incompleteReason(report, options),
    });

    emit(report, gate, options);
    if (report.cancelled) process.exitCode = EXIT.cancelled;
    else process.exitCode = gate.passed ? EXIT.ok : EXIT.threshold;
  } catch (error) {
    process.exitCode = handleError(error, verbose);
  }
}

/**
 * Describes why a run could not finish what was asked of it. A partial or
 * empty result must not be reported as a clean pass.
 */
function incompleteReason(report: Report, options: Options): string | null {
  if (report.cancelled) return "run stopped before finishing";
  if (options.crawl && !report.crawl?.report?.pages.length) {
    const skipped = report.crawl?.report?.skipped.length ?? 0;
    if (skipped) return `crawl found no reachable pages (${skipped} blocked by robots.txt)`;
    return "crawl found no pages in any sitemap";
  }
  return null;
}

/** A crawl is judged on its own average, not the entry page alone. */
function scoreFor(report: Report, focus: string): number {
  const crawl = report.crawl?.report;
  if (focus === "crawl" && crawl?.pages.length) return crawl.averageScore;
  return report.seo.score;
}

function gatedStatuses(report: Report, focus: string) {
  const statuses: CheckStatus[] = [];
  const includes = (name: string) => focus === "full" || focus === name;

  if (includes("basic")) statuses.push(...report.seo.checks.map((check) => check.status));
  if (report.schema && includes("schema"))
    statuses.push(...report.schema.issues.map((issue) => issue.severity));
  if (report.vitalsChecks && includes("vitals"))
    statuses.push(...report.vitalsChecks.map((check) => check.status));
  if (report.crawl?.report && includes("crawl"))
    statuses.push(...report.crawl.report.pages.map((page) => page.worstStatus));
  return statuses;
}

function emit(report: Report, gate: ReturnType<typeof evaluateGate>, options: Options) {
  if (options.json) {
    printJson(report, gate);
    return;
  }
  if (options.quiet) {
    printQuiet(report);
    return;
  }
  printReport(report, options.color, options.focus);
  printGate(gate, pc.createColors(options.color));
  outro(report.cancelled ? "Stopped early — partial report." : "Done.");
}

/** Aborts on Ctrl+C or when the overall time budget runs out. */
function watchForCancel(maxSeconds: number) {
  const controller = new AbortController();
  const onSigint = () => controller.abort();
  const timer = setTimeout(() => controller.abort(), maxSeconds * 1000);
  process.once("SIGINT", onSigint);
  return {
    controller,
    stop() {
      clearTimeout(timer);
      process.off("SIGINT", onSigint);
    },
  };
}

function makeProgress(verbose: boolean): Progress & { done: () => void } {
  // Spinner frames would litter a redirected stream, so only animate on a TTY.
  if (!verbose || !process.stdout.isTTY)
    return { step: () => {}, update: () => {}, done: () => {} };
  const spin = spinner();
  let started = false;
  return {
    step(message) {
      if (started) spin.message(message);
      else {
        spin.start(message);
        started = true;
      }
    },
    update(message) {
      if (started) spin.message(message);
    },
    done() {
      if (started) spin.stop("Analysis complete");
    },
  };
}

async function ensureBrowser(interactive: boolean, autoYes?: boolean) {
  if (hasBrowser()) return;
  if (!interactive && !autoYes)
    throw new UsageError(
      "Chromium is required for rendering. Install it with `npx playwright install chromium`, or pass --yes.",
    );
  const allowed = autoYes || (await askYesNo("Chromium is needed (~200 MB). Install it now?", true));
  if (!allowed) throw new UsageError("Rendering needs Chromium. Re-run without --render or --vitals.");
  log.info("Installing Chromium…");
  installBrowser();
}

function handleError(error: unknown, verbose: boolean): number {
  if (error instanceof Cancelled) return EXIT.cancelled;
  if (error instanceof UsageError) {
    if (verbose) log.error(error.message);
    else console.error(`sitebot: ${error.message}`);
    return EXIT.usage;
  }
  const message = error instanceof Error ? error.message : "Unexpected failure.";
  if (verbose) log.error(message);
  else console.error(`sitebot: ${message}`);
  return EXIT.runtime;
}
