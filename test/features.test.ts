import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { evaluateGate, parseFailOn, parseMinScore, UsageError } from "../src/gate.js";
import { validateSchemas } from "../src/schema.js";
import { evaluateVitals } from "../src/vitals.js";
import { runPool } from "../src/pool.js";
import { parsePage } from "../src/parser.js";

test("gate passes when nothing breaches the thresholds", () => {
  const gate = evaluateGate({
    failOn: "error",
    minScore: 50,
    status: 200,
    score: 80,
    statuses: ["pass", "warning"],
    brokenLinks: 0,
  });
  strictEqual(gate.passed, true);
});

test("gate reports every reason it failed", () => {
  const gate = evaluateGate({
    failOn: "warning",
    minScore: 90,
    status: 500,
    score: 40,
    statuses: ["error", "warning"],
    brokenLinks: 2,
  });
  strictEqual(gate.passed, false);
  deepStrictEqual(gate.reasons, [
    "HTTP 500",
    "score 40 below minimum 90",
    "1 error check",
    "1 warning",
    "2 broken links",
  ]);
});

test("gate ignores check statuses when fail-on is never", () => {
  const gate = evaluateGate({
    failOn: "never",
    minScore: null,
    status: 200,
    score: 10,
    statuses: ["error"],
    brokenLinks: 5,
  });
  strictEqual(gate.passed, true);
});

test("rejects invalid gate options", () => {
  let failed = false;
  try {
    parseFailOn("sometimes");
  } catch (error) {
    failed = error instanceof UsageError;
  }
  strictEqual(failed, true);
  strictEqual(parseMinScore(undefined), null);
});

test("flags schema nodes missing required properties", () => {
  const report = validateSchemas([
    { "@type": "Product", name: "Chair" },
    { "@type": "Article", image: "a.png" },
  ]);
  strictEqual(report.validCount, 1);
  const errors = report.issues.filter((issue) => issue.severity === "error");
  strictEqual(errors.length, 1);
  strictEqual(errors[0].message.includes("headline"), true);
});

test("expands @graph containers", () => {
  const report = validateSchemas([
    { "@graph": [{ "@type": "Organization", name: "Acme" }, { "@type": "WebSite", name: "Site" }] },
  ]);
  deepStrictEqual(report.types, ["Organization", "WebSite"]);
});

test("grades vitals against Google thresholds", () => {
  const checks = evaluateVitals({
    ttfbMs: 100,
    fcpMs: 900,
    lcpMs: 5000,
    cls: 0.15,
    tbtMs: 50,
    domContentLoadedMs: null,
    loadMs: null,
    requestCount: 1,
    transferBytes: 0,
  });
  const byKey = Object.fromEntries(checks.map((check) => [check.key, check.status]));
  strictEqual(byKey.lcpMs, "error");
  strictEqual(byKey.cls, "warning");
  strictEqual(byKey.tbtMs, "pass");
});

test("pool honours the concurrency limit", async () => {
  let active = 0;
  let peak = 0;
  const items = Array.from({ length: 12 }, (_, i) => i);
  const results = await runPool(
    items,
    { limit: 3, delayMs: 0, signal: new AbortController().signal },
    async (item) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return item;
    },
  );
  strictEqual(results.length, 12);
  strictEqual(peak <= 3, true);
});

test("pool stops early once aborted", async () => {
  const controller = new AbortController();
  let ran = 0;
  await runPool(
    Array.from({ length: 20 }, (_, i) => i),
    { limit: 2, delayMs: 0, signal: controller.signal },
    async (item) => {
      ran++;
      if (item === 1) controller.abort();
      return item;
    },
  );
  strictEqual(ran < 20, true);
});

test("collects absolute links and skips anchors and mailto", () => {
  const html = `<html><body>
    <a href="/about">About</a>
    <a href="#top">Top</a>
    <a href="mailto:a@b.com">Mail</a>
    <a href="https://other.com/x">Out</a>
    <a href="/about">Dupe</a>
  </body></html>`;
  const meta = parsePage(html, "https://example.com/");
  deepStrictEqual(
    meta.links.map((link) => link.url),
    ["https://example.com/about", "https://other.com/x"],
  );
  strictEqual(meta.links[0].internal, true);
  strictEqual(meta.links[1].internal, false);
});

test("a narrow run is not failed by checks it never showed", () => {
  // A crawl-only run must not inherit the entry page's SEO errors.
  const gate = evaluateGate({
    failOn: "error",
    minScore: null,
    status: 200,
    score: 70,
    statuses: [],
    brokenLinks: 0,
  });
  strictEqual(gate.passed, true);
});

test("a crawl still fails when its own pages have errors", () => {
  const gate = evaluateGate({
    failOn: "error",
    minScore: null,
    status: 200,
    score: 70,
    statuses: ["pass", "error", "error"],
    brokenLinks: 0,
  });
  strictEqual(gate.passed, false);
  strictEqual(gate.reasons[0], "2 error checks");
});

test("table aligns columns around ANSI colour codes", async () => {
  const { table, visibleWidth, stripAnsi } = await import("../src/table.js");
  const esc = String.fromCharCode(27);
  const green = `${esc}[32mOK${esc}[39m`;
  strictEqual(visibleWidth(green), 2);
  strictEqual(stripAnsi(green), "OK");

  const output = table([{ header: "A" }, { header: "B" }], [[green, "longer"]]);
  const lines = output.split("\n").map(stripAnsi);
  const widths = new Set(lines.map((line) => line.length));
  strictEqual(widths.size, 1, "every row is the same visible width");
});

test("table right-aligns numeric columns", async () => {
  const { table, stripAnsi } = await import("../src/table.js");
  const output = table(
    [{ header: "Field" }, { header: "Value", align: "right" as const }],
    [["Requests", "7"], ["Transferred", "856 KB"]],
  );
  const rows = output.split("\n").map(stripAnsi);
  strictEqual(rows.some((row) => row.includes("│      7 │")), true);
});

test("table shrinks to the terminal width", async () => {
  const { table, stripAnsi } = await import("../src/table.js");
  const previous = process.env.COLUMNS;
  process.env.COLUMNS = "50";
  try {
    const output = table(
      [{ header: "Field" }, { header: "Value" }],
      [["URL", "https://example.com/a/very/long/path/that/keeps/going/and/going"]],
    );
    for (const line of output.split("\n")) strictEqual(stripAnsi(line).length <= 50, true);
  } finally {
    if (previous === undefined) delete process.env.COLUMNS;
    else process.env.COLUMNS = previous;
  }
});

test("reports which AI crawlers robots.txt allows", async () => {
  const { evaluateAiAccess } = await import("../src/robots.js");
  const robots = [
    "User-agent: *",
    "Allow: /",
    "",
    "User-agent: GPTBot",
    "Disallow: /",
    "",
    "User-agent: CCBot",
    "Disallow: /private",
  ].join("\n");

  const access = evaluateAiAccess(robots, "https://example.com/article");
  const byName = Object.fromEntries(access.map((a) => [a.name, a.status]));
  strictEqual(byName.GPTBot, "disallowed", "named block is honoured");
  strictEqual(byName.ClaudeBot, "allowed", "falls back to the wildcard group");
  strictEqual(byName.CCBot, "allowed", "a rule on another path does not block this one");
});

test("adds custom agents without duplicating built-ins", async () => {
  const { evaluateAiAccess } = await import("../src/robots.js");
  const access = evaluateAiAccess(
    "User-agent: *\nAllow: /",
    "https://example.com/",
    ["MyBot", "gptbot"],
  );
  strictEqual(access.filter((a) => a.name.toLowerCase() === "gptbot").length, 1);
  strictEqual(access.some((a) => a.name === "MyBot"), true);
});
