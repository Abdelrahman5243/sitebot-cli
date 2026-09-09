#!/usr/bin/env node
import { Command } from "commander";
import { run } from "./app.js";
import { EXIT } from "./gate.js";

new Command()
  .name("sitebot")
  .description("Fast terminal SEO, GEO, and performance auditing")
  .version("1.3.0")
  .argument("[url]", "website URL to inspect")
  .option("-b, --bot <profile>", "google or browser", "google")
  .option("-t, --timeout <seconds>", "per-request timeout", "10")
  .option("--crawl", "crawl the whole site from its sitemap")
  .option("--limit <pages>", "maximum pages to crawl", "100")
  .option("--concurrency <n>", "parallel requests while crawling", "5")
  .option("--links", "check every link on the page for breakage")
  .option("--external-links", "include links to other domains")
  .option("--vitals", "measure Core Web Vitals on mobile and desktop")
  .option("--render", "audit the browser-rendered HTML")
  .option("--no-schema", "skip structured data validation")
  .option("--agents <names>", "extra robots.txt user-agents to check, comma-separated")
  .option("--fail-on <level>", "never, error, or warning", "error")
  .option("--min-score <score>", "fail below this SEO score")
  .option("--max-seconds <seconds>", "overall time budget", "300")
  .option("--pages <paths>", "audit comma-separated paths")
  .option("-y, --yes", "accept prompts (installs Chromium if needed)")
  .option("--json", "print machine-readable JSON")
  .option("--quiet", "print only the final score")
  .option("--no-color", "disable terminal colors")
  .addHelpText(
    "after",
    `
Exit codes:
  0  all checks passed
  1  a gate condition failed (--fail-on / --min-score)
  2  invalid usage
  3  runtime failure

Examples:
  sitebot                                   guided prompts
  sitebot https://example.com --crawl --links
  sitebot https://example.com --vitals
  sitebot https://example.com --min-score 80 --fail-on warning
  sitebot https://example.com --json > report.json`,
  )
  .action(run)
  .parseAsync()
  .catch((error: Error) => {
    console.error(`sitebot: ${error.message}`);
    process.exitCode = EXIT.runtime;
  });
