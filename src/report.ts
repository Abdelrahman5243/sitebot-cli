import pc from "picocolors";
import type { Colors, Report } from "./types.js";
import type { GateResult } from "./gate.js";
import { evaluateVitals } from "./vitals.js";
import { table, truncate } from "./table.js";

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
  if (show("vitals") && (r.deviceVitals || r.vitalsChecks)) vitalsSection(r, c);
  if (r.links && show("links")) linksSection(r, c);
  if (r.crawl && show("crawl")) crawlSection(r, c);
  if (r.pages?.length) pagesSection(r, c);
}

function overview(r: Report, c: Ink) {
  heading(c, "Overview");
  console.log(
    table(
      [{ header: "Field" }, { header: "Value" }],
      [
        ["URL", truncate(r.finalUrl, 60)],
        ["Status", `${statusInk(r.status, c)} ${r.statusText}`],
        ["Response", `${r.responseTimeMs}ms`],
        ["Bot", r.bot],
        ["Redirects", String(r.redirects.length)],
        ["Score", `${scoreInk(r.seo.score, c)} / 100`],
      ],
    ),
  );
}

function metadata(r: Report, c: Ink) {
  heading(c, "Metadata");
  const rows: string[][] = [
    row(c, Boolean(r.metadata.title), "Title", r.metadata.title ?? "missing"),
    row(c, Boolean(r.metadata.description), "Description", r.metadata.description ?? "missing"),
    row(c, Boolean(r.metadata.canonical), "Canonical", r.metadata.canonical ?? "missing"),
    row(c, r.metadata.h1Count === 1, "H1", `${r.metadata.h1Count} found`),
    row(c, Boolean(r.metadata.openGraph["og:title"]), "Open Graph", ogSummary(r)),
    row(c, r.robots.status === "allowed", "robots.txt", r.robots.status),
  ];
  console.log(table([{ header: "" }, { header: "Tag" }, { header: "Value" }], rows));
}

function ogSummary(r: Report) {
  const present = ["og:title", "og:description", "og:image"].filter(
    (key) => r.metadata.openGraph[key],
  );
  return `${present.length}/3 tags`;
}

function seoChecks(r: Report, c: Ink) {
  heading(c, "SEO Checks");
  console.log(
    table(
      [{ header: "" }, { header: "Check" }, { header: "Result" }],
      r.seo.checks.map((check) => [icon(c, check.status), check.label, check.message]),
    ),
  );
}

function geoSection(r: Report, c: Ink) {
  heading(c, "Technical GEO");
  const keys = ["sitemap", "llms", "hreflang", "lang", "viewport", "content"] as const;
  console.log(
    table(
      [{ header: "" }, { header: "Signal" }, { header: "Result" }],
      keys.map((key) => [icon(c, r.site[key].status), key, r.site[key].message]),
    ),
  );
}

function schemaSection(r: Report, c: Ink) {
  const schema = r.schema!;
  heading(c, "Structured Data");
  if (!schema.types.length) {
    console.log(`  ${icon(c, "warning")} No JSON-LD found on this page.`);
    return;
  }
  console.log(
    table(
      [{ header: "Field" }, { header: "Value" }],
      [
        ["Types", schema.types.join(", ")],
        ["Valid nodes", String(schema.validCount)],
        ["Issues", String(schema.issues.length)],
      ],
    ),
  );
  if (!schema.issues.length) return;
  console.log();
  console.log(
    table(
      [{ header: "" }, { header: "Type" }, { header: "Issue" }],
      schema.issues
        .slice(0, 12)
        .map((issue) => [icon(c, issue.severity), issue.type, truncate(issue.message, 60)]),
    ),
  );
  if (schema.issues.length > 12)
    console.log(c.dim(`  … ${schema.issues.length - 12} more issues`));
}

/** Mobile and desktop side by side, since Google ranks on the mobile result. */
function vitalsSection(r: Report, c: Ink) {
  heading(c, "Core Web Vitals");
  const mobile = r.deviceVitals?.mobile ?? null;
  const desktop = r.deviceVitals?.desktop ?? r.vitals ?? null;

  if (mobile && desktop) {
    const mobileChecks = evaluateVitals(mobile);
    const desktopChecks = evaluateVitals(desktop);
    const rows = mobileChecks.map((check, index) => {
      const other = desktopChecks[index];
      return [
        check.label,
        `${icon(c, check.status)} ${check.message}`,
        `${icon(c, other.status)} ${other.message}`,
      ];
    });
    console.log(
      table(
        [{ header: "Metric" }, { header: "Mobile" }, { header: "Desktop" }],
        rows,
      ),
    );
    console.log();
    console.log(
      table(
        [{ header: "" }, { header: "Mobile", align: "right" }, { header: "Desktop", align: "right" }],
        [
          ["Requests", String(mobile.requestCount), String(desktop.requestCount)],
          ["Transferred", kb(mobile.transferBytes), kb(desktop.transferBytes)],
        ],
      ),
    );
    console.log(
      c.dim("  Mobile is throttled to a mid-tier phone on 4G, matching Lighthouse."),
    );
  } else {
    const only = mobile ?? desktop;
    if (!only) return;
    console.log(
      table(
        [{ header: "" }, { header: "Metric" }, { header: "Result" }],
        evaluateVitals(only).map((check) => [icon(c, check.status), check.label, check.message]),
      ),
    );
    console.log(
      table(
        [{ header: "Field" }, { header: "Value", align: "right" }],
        [
          ["Requests", String(only.requestCount)],
          ["Transferred", kb(only.transferBytes)],
        ],
      ),
    );
  }

  const errors = r.rendered?.consoleErrors ?? [];
  if (errors.length) console.log(`  ${icon(c, "warning")} ${errors.length} console error(s)`);
}

function kb(bytes: number) {
  return bytes ? `${Math.round(bytes / 1024)} KB` : "unknown";
}

function linksSection(r: Report, c: Ink) {
  const links = r.links!;
  heading(c, "Links");
  if (!links.checked) {
    console.log(`  ${icon(c, "warning")} This page has no links to check.`);
    return;
  }
  console.log(
    table(
      [{ header: "Field" }, { header: "Value", align: "right" }],
      [
        ["Checked", String(links.checked)],
        ["Internal", String(links.internalCount)],
        ["External", String(links.externalCount)],
        ["Broken", broken(links.broken.length, c)],
        ["Unreachable", String(links.unreachable.length)],
        ["Redirecting", String(links.redirects.length)],
      ],
    ),
  );

  if (links.broken.length) {
    console.log();
    console.log(
      table(
        [{ header: "Status" }, { header: "Broken link" }],
        links.broken
          .slice(0, 15)
          .map((link) => [c.red(String(link.status)), truncate(link.url, 64)]),
      ),
    );
    if (links.broken.length > 15)
      console.log(c.dim(`  … ${links.broken.length - 15} more broken links`));
  }
  if (links.unreachable.length) {
    console.log(
      c.dim(`  ${links.unreachable.length} link(s) timed out — slow, not proven broken:`),
    );
    for (const link of links.unreachable.slice(0, 5))
      console.log(c.dim(`    ${truncate(link.url, 68)}`));
  }
  if (links.truncated)
    console.log(c.dim("  Link budget reached; some links were not checked."));
}

function broken(count: number, c: Ink) {
  return count ? c.red(String(count)) : c.green("0");
}

function crawlSection(r: Report, c: Ink) {
  const { sitemap, report } = r.crawl!;
  heading(c, "Site Crawl");
  if (!report) {
    console.log(`  ${icon(c, "warning")} No URLs found in any sitemap.`);
    return;
  }
  if (!report.pages.length) {
    console.log(
      `  ${icon(c, "warning")} Found ${sitemap.urls.length} URL(s), crawled 0` +
        (report.skipped.length ? ` — all blocked by robots.txt` : "."),
    );
    return;
  }

  console.log(
    table(
      [{ header: "Field" }, { header: "Value", align: "right" }],
      [
        ["Pages crawled", String(report.pages.length)],
        ["Average score", `${scoreInk(report.averageScore, c)} / 100`],
        ["Skipped (robots)", String(report.skipped.length)],
        ["Duplicate titles", String(report.duplicateTitles.length)],
        ["Duplicate descriptions", String(report.duplicateDescriptions.length)],
        ["Missing titles", String(report.missingTitles.length)],
        ["Missing descriptions", String(report.missingDescriptions.length)],
      ],
    ),
  );
  if (report.stoppedEarly) console.log(c.yellow("  Crawl stopped early."));

  duplicates(c, "Duplicate titles", report.duplicateTitles);
  duplicates(c, "Duplicate descriptions", report.duplicateDescriptions);

  const failures = report.pages.filter((page) => page.error || page.status >= 400);
  if (failures.length) {
    console.log();
    console.log(
      table(
        [{ header: "Status" }, { header: "Failed page" }],
        failures
          .slice(0, 10)
          .map((page) => [
            c.red(String(page.status || "ERR")),
            truncate(page.error ? `${page.url} — ${page.error}` : page.url, 64),
          ]),
      ),
    );
  }

  const withErrors = report.pages.filter(
    (page) => !page.error && page.worstStatus === "error",
  );
  if (withErrors.length) {
    console.log();
    console.log(c.dim(`  ${withErrors.length} page(s) missing a title, description, or H1:`));
    for (const page of withErrors.slice(0, 5))
      console.log(c.dim(`    ${truncate(page.url, 68)}`));
    if (withErrors.length > 5) console.log(c.dim(`    … ${withErrors.length - 5} more`));
  }

  const worst = report.pages
    .filter((page) => !page.error)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);
  if (worst.length) {
    console.log();
    console.log(
      table(
        [{ header: "Score", align: "right" }, { header: "Lowest scoring pages" }],
        worst.map((page) => [scoreInk(page.score, c), truncate(page.url, 62)]),
      ),
    );
  }
}

function duplicates(c: Ink, label: string, groups: { value: string; urls: string[] }[]) {
  if (!groups.length) return;
  console.log();
  console.log(c.dim(`  ${label}:`));
  for (const group of groups.slice(0, 5)) {
    console.log(`    ${c.yellow(`"${truncate(group.value, 56)}"`)} on ${group.urls.length} pages`);
    for (const url of group.urls.slice(0, 3)) console.log(c.dim(`      ${truncate(url, 66)}`));
  }
}

function pagesSection(r: Report, c: Ink) {
  heading(c, "Page Audit");
  console.log(
    table(
      [{ header: "" }, { header: "Status" }, { header: "Page" }],
      r.pages!.map((page) => {
        const ok = page.status >= 200 && page.status < 400;
        return [
          icon(c, ok ? "pass" : "error"),
          String(page.status || "ERR"),
          truncate(`${page.url} — ${page.title ?? page.error ?? "no title"}`, 60),
        ];
      }),
    ),
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

function row(c: Ink, ok: boolean, key: string, value: string) {
  return [icon(c, ok ? "pass" : "warning"), key, truncate(value, 58)];
}

function icon(c: Ink, level: "pass" | "warning" | "error") {
  return level === "pass" ? c.green("✓") : level === "warning" ? c.yellow("!") : c.red("✗");
}

function statusInk(code: number, c: Ink) {
  const text = String(code);
  return code < 300 ? c.green(text) : code < 400 ? c.yellow(text) : c.red(text);
}

function scoreInk(score: number, c: Ink) {
  const text = String(score);
  return score >= 80 ? c.green(text) : score >= 50 ? c.yellow(text) : c.red(text);
}
