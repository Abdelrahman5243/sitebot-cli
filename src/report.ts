import pc from "picocolors";
import type { Colors, Report } from "./types.js";
import type { GateResult } from "./gate.js";

type Ink = ReturnType<typeof pc.createColors>;

export function printJson(report: Report, gate: GateResult) {
  console.log(JSON.stringify({ ...report, gate }, null, 2));
}

export function printQuiet(report: Report) {
  console.log(`SEO Score: ${report.seo.score}/100`);
}

/**
 * `focus` is the single section the user picked in the wizard. "full" shows
 * everything; anything else shows the overview plus just that section, so a
 * narrow choice gives a narrow answer.
 */
export function printReport(r: Report, colorEnabled: boolean, focus = "full") {
  const c = pc.createColors(colorEnabled);
  const show = (name: string) => focus === "full" || focus === name;

  overview(r, c);
  if (show("basic")) {
    metadata(r, c);
    seoChecks(r, c);
    geoSection(r, c);
  }
  if (r.schema && show("schema")) schemaSection(r, c);
  if (r.vitalsChecks && show("vitals")) vitalsSection(r, c);
  if (r.links && show("links")) linksSection(r, c);
  if (r.crawl && show("crawl")) crawlSection(r, c);
  if (r.pages?.length) pagesSection(r, c);
}

function overview(r: Report, c: Ink) {
  heading(c, "Overview");
  field(c, "URL", r.finalUrl);
  field(c, "Status", `${statusInk(r.status, c)} ${r.statusText}`);
  field(c, "Response", `${r.responseTimeMs}ms`);
  field(c, "Bot", r.bot);
  if (r.redirects.length) field(c, "Redirects", String(r.redirects.length));
  field(c, "Score", `${scoreInk(r.seo.score, c)} / 100`);
}

function metadata(r: Report, c: Ink) {
  heading(c, "Metadata");
  mark(c, Boolean(r.metadata.title), "Title", r.metadata.title ?? "missing");
  mark(c, Boolean(r.metadata.description), "Description", r.metadata.description ?? "missing");
  mark(c, Boolean(r.metadata.canonical), "Canonical", r.metadata.canonical ?? "missing");
  mark(c, r.metadata.h1Count === 1, "H1", `${r.metadata.h1Count} found`);
  mark(c, Boolean(r.metadata.openGraph["og:title"]), "Open Graph", ogSummary(r));
  mark(c, r.robots.status === "allowed", "robots.txt", r.robots.status);
}

function ogSummary(r: Report) {
  const present = ["og:title", "og:description", "og:image"].filter(
    (key) => r.metadata.openGraph[key],
  );
  return `${present.length}/3 tags`;
}

function seoChecks(r: Report, c: Ink) {
  heading(c, "SEO Checks");
  for (const check of r.seo.checks) status(c, check.status, check.label, check.message);
}

function geoSection(r: Report, c: Ink) {
  heading(c, "Technical GEO");
  for (const key of ["sitemap", "llms", "hreflang", "lang", "viewport", "content"] as const)
    status(c, r.site[key].status, key, r.site[key].message);
}

function schemaSection(r: Report, c: Ink) {
  const schema = r.schema!;
  heading(c, "Structured Data");
  if (!schema.types.length) {
    status(c, "warning", "schema", "No JSON-LD found.");
    return;
  }
  field(c, "Types", schema.types.join(", "));
  field(c, "Valid", `${schema.validCount} node${schema.validCount === 1 ? "" : "s"}`);
  for (const issue of schema.issues.slice(0, 12))
    status(c, issue.severity, issue.type, issue.message);
  if (schema.issues.length > 12)
    console.log(c.dim(`  … ${schema.issues.length - 12} more issues`));
}

function vitalsSection(r: Report, c: Ink) {
  heading(c, "Core Web Vitals");
  for (const check of r.vitalsChecks!) status(c, check.status, check.label, check.message);
  const vitals = r.vitals!;
  field(c, "Requests", String(vitals.requestCount));
  if (vitals.transferBytes)
    field(c, "Transferred", `${Math.round(vitals.transferBytes / 1024)} KB`);
  const errors = r.rendered?.consoleErrors ?? [];
  if (errors.length) status(c, "warning", "Console", `${errors.length} error(s)`);
}

function linksSection(r: Report, c: Ink) {
  const links = r.links!;
  heading(c, "Links");
  field(c, "Checked", `${links.checked} (${links.internalCount} internal, ${links.externalCount} external)`);
  if (!links.broken.length) {
    status(c, "pass", "Broken", "None found.");
  } else {
    for (const link of links.broken.slice(0, 15))
      status(c, "error", String(link.status || "ERR"), `${link.url}${link.error ? ` — ${link.error}` : ""}`);
    if (links.broken.length > 15)
      console.log(c.dim(`  … ${links.broken.length - 15} more broken links`));
  }
  if (links.redirects.length)
    status(c, "warning", "Redirects", `${links.redirects.length} link(s) redirect`);
  if (links.truncated) console.log(c.dim("  Link budget reached; some links were not checked."));
}

function crawlSection(r: Report, c: Ink) {
  const { sitemap, report } = r.crawl!;
  heading(c, "Site Crawl");
  if (!report) {
    status(c, "warning", "sitemap", "No URLs found in any sitemap.");
    return;
  }
  // Nothing was fetched, so per-page findings would all be misleading zeroes.
  if (!report.pages.length) {
    field(c, "Found", `${sitemap.urls.length} URL(s) in sitemap`);
    status(
      c,
      "warning",
      "Crawled",
      report.skipped.length
        ? `0 pages — all ${report.skipped.length} are disallowed by robots.txt`
        : "0 pages.",
    );
    return;
  }

  field(c, "Pages", String(report.pages.length));
  field(c, "Average score", `${scoreInk(report.averageScore, c)} / 100`);
  if (report.skipped.length) field(c, "Skipped", `${report.skipped.length} (robots.txt)`);
  if (report.stoppedEarly) console.log(c.yellow("  Crawl stopped early."));

  reportGroup(c, "Duplicate titles", report.duplicateTitles);
  reportGroup(c, "Duplicate descriptions", report.duplicateDescriptions);
  listUrls(c, "Missing titles", report.missingTitles);
  listUrls(c, "Missing descriptions", report.missingDescriptions);

  const failures = report.pages.filter((page) => page.error || page.status >= 400);
  for (const page of failures.slice(0, 10))
    status(c, "error", String(page.status || "ERR"), `${page.url}${page.error ? ` — ${page.error}` : ""}`);

  const withErrors = report.pages.filter(
    (page) => !page.error && page.worstStatus === "error",
  );
  if (withErrors.length) {
    status(
      c,
      "error",
      "Failing pages",
      `${withErrors.length} page(s) missing a title, description, or H1`,
    );
    for (const page of withErrors.slice(0, 5)) console.log(c.dim(`    ${page.url}`));
    if (withErrors.length > 5)
      console.log(c.dim(`    … ${withErrors.length - 5} more`));
  }

  const worst = report.pages
    .filter((page) => !page.error)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);
  if (worst.length) {
    console.log(c.dim("\n  Lowest scoring pages:"));
    for (const page of worst)
      console.log(`  ${scoreInk(page.score, c)}  ${page.url}`);
  }
}

function reportGroup(c: Ink, label: string, groups: { value: string; urls: string[] }[]) {
  if (!groups.length) {
    status(c, "pass", label, "None.");
    return;
  }
  status(c, "warning", label, `${groups.length} group(s)`);
  for (const group of groups.slice(0, 5)) {
    console.log(c.dim(`    "${truncate(group.value, 60)}" on ${group.urls.length} pages`));
    for (const url of group.urls.slice(0, 3)) console.log(c.dim(`      ${url}`));
  }
}

function listUrls(c: Ink, label: string, urls: string[]) {
  if (!urls.length) return;
  status(c, "warning", label, `${urls.length} page(s)`);
  for (const url of urls.slice(0, 5)) console.log(c.dim(`    ${url}`));
}

function pagesSection(r: Report, c: Ink) {
  heading(c, "Page Audit");
  for (const page of r.pages!)
    status(
      c,
      page.status >= 200 && page.status < 400 ? "pass" : "error",
      String(page.status || "ERR"),
      `${page.url} — ${page.title ?? page.error ?? "no title"}`,
    );
}

export function printGate(gate: GateResult, c: Colors) {
  if (gate.passed) {
    console.log(`\n${c.green("PASS")} All gate conditions met.`);
    return;
  }
  console.log(`\n${c.red("FAIL")} ${gate.reasons.join("; ")}.`);
}

function heading(c: Ink, title: string) {
  console.log(`\n${c.bold(c.cyan(title))}`);
}

function field(c: Ink, key: string, value: string) {
  console.log(`  ${c.dim(key.padEnd(14))}${value}`);
}

function mark(c: Ink, ok: boolean, key: string, value: string) {
  status(c, ok ? "pass" : "warning", key, truncate(value, 70));
}

function status(c: Ink, level: "pass" | "warning" | "error", key: string, message: string) {
  const icon = level === "pass" ? c.green("✓") : level === "warning" ? c.yellow("!") : c.red("✗");
  console.log(`  ${icon} ${c.dim(`${key}:`)} ${message}`);
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function statusInk(code: number, c: Ink) {
  const text = String(code);
  return code < 300 ? c.green(text) : code < 400 ? c.yellow(text) : c.red(text);
}

function scoreInk(score: number, c: Ink) {
  const text = String(score);
  return score >= 80 ? c.green(text) : score >= 50 ? c.yellow(text) : c.red(text);
}
