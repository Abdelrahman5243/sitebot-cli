#!/usr/bin/env node
// Reads a sitebot JSON report and writes the GitHub Action outputs and job
// summary. Kept in Node so report values never pass through a shell.
import { appendFileSync, readFileSync } from "node:fs";

const [reportPath, url] = process.argv.slice(2);
const report = JSON.parse(readFileSync(reportPath, "utf8"));

const crawl = report.crawl?.report ?? null;
const score = report.seo?.score ?? 0;
const passed = report.gate?.passed === true;
const reasons = (report.gate?.reasons ?? []).join("; ");
const broken = report.links?.broken?.length ?? 0;

write(process.env.GITHUB_OUTPUT, [
  `score=${score}`,
  `passed=${passed}`,
  `broken-links=${broken}`,
]);

const rows = [`| SEO score | ${score} / 100 |`];
if (crawl?.pages?.length)
  rows.push(`| Pages crawled | ${crawl.pages.length} (avg ${crawl.averageScore} / 100) |`);
if (report.links) rows.push(`| Broken links | ${broken} |`);
if (report.links?.unreachable?.length)
  rows.push(`| Unreachable links | ${report.links.unreachable.length} |`);
for (const [device, vitals] of Object.entries(report.deviceVitals ?? {})) {
  if (vitals) rows.push(`| LCP (${device}) | ${vitals.lcpMs}ms |`);
}
rows.push(`| Gate | ${passed ? "passed" : `**failed** — ${escape(reasons)}`} |`);

write(process.env.GITHUB_STEP_SUMMARY, [
  "## sitebot audit",
  "",
  `**${escape(url)}** — HTTP ${report.status ?? 0}`,
  "",
  "| Result | Value |",
  "| --- | --- |",
  ...rows,
]);

if (!passed) {
  console.log(`::error::sitebot gate failed — ${reasons}`);
  process.exitCode = 1;
}

function write(target, lines) {
  if (!target) return;
  appendFileSync(target, `${lines.join("\n")}\n`);
}

/** Keeps report text from breaking out of the markdown table. */
function escape(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}
