import pc from "picocolors";
import type { AuditReport, Colors, SeoReport } from "./types.js";
import type { SiteChecks } from "./site-checks.js";
import type { PageAudit } from "./multi.js";
type Report = AuditReport & { site: SiteChecks; pages?: PageAudit[] };
export function printJson(report: Report) {
  console.log(
    JSON.stringify(report, (_, v) => (v === undefined ? undefined : v), 2),
  );
}
export function printQuiet(score: number) {
  console.log(`SEO Score: ${score}/100`);
}
export function printTerminal(r: Report, enabled: boolean) {
  const c = pc.createColors(enabled);
  console.log(
    `\n${c.bold(c.cyan("Sitebot Report"))}\n${c.dim("─".repeat(42))}`,
  );
  line(c, "URL", r.requestedUrl);
  line(c, "Final URL", r.finalUrl);
  line(c, "Status", `${status(r.status, c)} ${r.statusText}`);
  line(c, "Fetch mode", r.rendered ? "raw + browser" : "raw HTML");
  line(c, "Response time", `${r.responseTimeMs}ms`);
  line(c, "Bot profile", r.bot);
  line(c, "Redirects", r.redirects.length);
  line(c, "X-Robots-Tag", r.headers.xRobotsTag ?? "not specified");
  console.log(`\n${c.bold("HTML Metadata")}`);
  meta(c, "Title", r.metadata.title);
  meta(c, "Description", r.metadata.description);
  meta(c, "Canonical", r.metadata.canonical);
  meta(c, "Meta Robots", r.metadata.robots, "not specified");
  console.log(
    `${r.metadata.h1Count === 1 ? c.green("✓") : c.yellow("⚠")} H1 count: ${r.metadata.h1Count}`,
  );
  console.log(`\n${c.bold("Open Graph / Twitter")}`);
  meta(c, "og:title", r.metadata.openGraph["og:title"]);
  meta(c, "og:description", r.metadata.openGraph["og:description"]);
  meta(c, "og:image", r.metadata.openGraph["og:image"]);
  meta(c, "twitter:card", r.metadata.twitter["twitter:card"]);
  console.log(`\n${c.bold("Robots")}`);
  console.log(
    `${r.robots.status === "allowed" ? c.green("✓") : c.yellow("⚠")} robots.txt: ${r.robots.status}`,
  );
  console.log(`\n${c.bold("SEO Checks")}`);
  checks(r.seo, c);
  console.log(`\n${c.bold("SEO Score:")} ${score(r.seo.score, c)} / 100`);
  console.log(`\n${c.bold("Technical GEO")}`);
  for (const key of [
    "sitemap",
    "llms",
    "hreflang",
    "lang",
    "viewport",
    "content",
  ] as const) {
    const value = r.site[key];
    console.log(
      `${value.status === "pass" ? c.green("✓") : c.yellow("⚠")} ${key}: ${value.message}`,
    );
  }
  console.log(`${c.bold("Schemas:")} ${r.site.schemas.join(", ") || "none"}`);
  if (r.rendered)
    console.log(
      `${c.bold("Browser render:")} ${r.rendered.status ?? "unknown"} / ${r.rendered.htmlSize} chars / ${r.rendered.responseTimeMs}ms`,
    );
  if (r.pages?.length) {
    console.log(`\n${c.bold("Page Audit")}`);
    for (const page of r.pages)
      console.log(
        `${page.status >= 200 && page.status < 400 ? c.green("✓") : c.red("✗")} ${page.status || "ERR"} ${page.url} — ${page.title ?? page.error ?? "no title"}`,
      );
  }
}
function line(c: Colors, key: string, value: unknown) {
  console.log(
    `${c.dim(`${key}:`)}${" ".repeat(Math.max(1, 16 - key.length))}${value}`,
  );
}
function meta(
  c: Colors,
  key: string,
  value?: string | null,
  empty = "missing",
) {
  console.log(
    `${value ? c.green("✓") : c.yellow("⚠")} ${key}: ${value ?? empty}`,
  );
}
function checks(r: SeoReport, c: Colors) {
  for (const x of r.checks)
    console.log(
      `${x.status === "pass" ? c.green("✓") : x.status === "warning" ? c.yellow("⚠") : c.red("✗")} ${x.label}: ${x.message}`,
    );
}
function status(n: number, c: Colors) {
  return n < 300
    ? c.green(String(n))
    : n < 400
      ? c.yellow(String(n))
      : c.red(String(n));
}
function score(n: number, c: Colors) {
  return n >= 80
    ? c.green(String(n))
    : n >= 50
      ? c.yellow(String(n))
      : c.red(String(n));
}
