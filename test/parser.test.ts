import assert from "node:assert/strict";
import test from "node:test";
import { parsePage } from "../src/parser.js";
import { evaluateSeo } from "../src/seo.js";
import { evaluateRobots } from "../src/robots.js";

test("parses core metadata and social tags", () => {
  const metadata = parsePage(
    `
    <html><head>
      <title>A useful title for a real page</title>
      <meta name="description" content="A useful description for this page with enough content to pass the basic SEO check." />
      <meta name="robots" content="index,follow" />
      <link rel="canonical" href="/products" />
      <meta property="og:title" content="A useful title" />
      <meta name="twitter:card" content="summary_large_image" />
    </head><body><h1>Products</h1></body></html>
  `,
    "https://example.com/",
  );

  assert.equal(metadata.canonical, "https://example.com/products");
  assert.equal(metadata.robots, "index,follow");
  assert.equal(metadata.openGraph["og:title"], "A useful title");
  assert.equal(metadata.twitter["twitter:card"], "summary_large_image");
  assert.equal(metadata.h1Count, 1);
  assert.equal(evaluateSeo(metadata).checks.length, 8);
});

test("evaluates robots.txt rules for the requested path", () => {
  const robots = evaluateRobots(
    "User-agent: *\nDisallow: /private\nAllow: /",
    "https://example.com/private",
    "google",
  );
  assert.equal(robots.status, "disallowed");
  assert.equal(robots.matchedRule, "disallow: /private");
});
