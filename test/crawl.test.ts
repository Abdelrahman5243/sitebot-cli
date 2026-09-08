import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { createServer, type Server } from "node:http";
import { collectSitemapUrls } from "../src/sitemap.js";
import { crawlSite } from "../src/crawl.js";
import { checkLinks } from "../src/links.js";

function startServer(routes: Record<string, { body: string; status?: number; type?: string }>) {
  return new Promise<{ server: Server; base: string }>((resolve) => {
    const server = createServer((req, res) => {
      const route = routes[req.url ?? ""];
      if (!route) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(route.status ?? 200, { "content-type": route.type ?? "text/html" });
      res.end(route.body);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

const page = (title: string, description = "") =>
  `<html lang="en"><head><title>${title}</title>${
    description ? `<meta name="description" content="${description}">` : ""
  }</head><body><h1>${title}</h1><p>${"word ".repeat(120)}</p></body></html>`;

test("follows a sitemap index and ignores other origins", async () => {
  const routes: Record<string, { body: string; status?: number; type?: string }> = {};
  const { server, base } = await startServer(routes);
  routes["/sitemap.xml"] = {
    type: "application/xml",
    body: `<?xml version="1.0"?><sitemapindex><sitemap><loc>${base}/nested.xml</loc></sitemap></sitemapindex>`,
  };
  routes["/nested.xml"] = {
    type: "application/xml",
    body: `<?xml version="1.0"?><urlset>
      <url><loc>${base}/a</loc></url>
      <url><loc><![CDATA[${base}/b?x=1&amp;y=2]]></loc></url>
      <url><loc>https://elsewhere.example/c</loc></url>
    </urlset>`,
  };

  const result = await collectSitemapUrls(base, "google", 5000, null, 100);
  deepStrictEqual(result.urls.sort(), [`${base}/a`, `${base}/b?x=1&y=2`].sort());
  server.close();
});

test("respects the page cap while reading a sitemap", async () => {
  const routes: Record<string, { body: string; status?: number; type?: string }> = {};
  const { server, base } = await startServer(routes);
  const entries = Array.from({ length: 20 }, (_, i) => `<url><loc>${base}/p${i}</loc></url>`).join("");
  routes["/sitemap.xml"] = {
    type: "application/xml",
    body: `<?xml version="1.0"?><urlset>${entries}</urlset>`,
  };
  const result = await collectSitemapUrls(base, "google", 5000, null, 5);
  strictEqual(result.urls.length, 5);
  server.close();
});

test("crawls pages and reports duplicate titles", async () => {
  const routes: Record<string, { body: string; status?: number; type?: string }> = {};
  const { server, base } = await startServer(routes);
  routes["/sitemap.xml"] = {
    type: "application/xml",
    body: `<?xml version="1.0"?><urlset>
      <url><loc>${base}/one</loc></url>
      <url><loc>${base}/two</loc></url>
      <url><loc>${base}/private</loc></url>
    </urlset>`,
  };
  routes["/one"] = { body: page("Same Title", "A description that is long enough to pass checks easily.") };
  routes["/two"] = { body: page("Same Title", "Another description long enough to pass the checks here.") };
  routes["/private"] = { body: page("Private") };

  const robots = "User-agent: *\nDisallow: /private\n";
  const sitemap = await collectSitemapUrls(base, "google", 5000, robots, 100);
  strictEqual(sitemap.urls.length, 3);

  const report = await crawlSite(sitemap.urls, {
    bot: "google",
    timeoutMs: 5000,
    limit: 100,
    concurrency: 2,
    delayMs: 0,
    robotsBody: robots,
    signal: new AbortController().signal,
  });

  strictEqual(report.pages.length, 2, "the disallowed page is not fetched");
  deepStrictEqual(report.skipped, [`${base}/private`]);
  strictEqual(report.duplicateTitles.length, 1);
  strictEqual(report.duplicateTitles[0].urls.length, 2);
  server.close();
});

test("finds broken links and leaves external ones alone by default", async () => {
  const { server, base } = await startServer({
    "/ok": { body: "fine" },
  });
  const links = [
    { url: `${base}/ok`, text: "ok", internal: true },
    { url: `${base}/missing`, text: "gone", internal: true },
    { url: "https://elsewhere.example/x", text: "out", internal: false },
  ];
  const report = await checkLinks(links, {
    bot: "google",
    timeoutMs: 5000,
    max: 50,
    concurrency: 2,
    delayMs: 0,
    includeExternal: false,
    signal: new AbortController().signal,
  });
  strictEqual(report.checked, 2, "external link is skipped");
  strictEqual(report.broken.length, 1);
  strictEqual(report.broken[0].status, 404);
  server.close();
});

test("skips every page when robots.txt disallows the whole site", async () => {
  const routes: Record<string, { body: string; status?: number; type?: string }> = {};
  const { server, base } = await startServer(routes);
  routes["/sitemap.xml"] = {
    type: "application/xml",
    body: `<?xml version="1.0"?><urlset>
      <url><loc>${base}/a</loc></url>
      <url><loc>${base}/b</loc></url>
    </urlset>`,
  };
  routes["/a"] = { body: page("A") };
  routes["/b"] = { body: page("B") };

  const robots = "User-Agent: *\nDisallow: /\n";
  const sitemap = await collectSitemapUrls(base, "google", 5000, robots, 100);
  const report = await crawlSite(sitemap.urls, {
    bot: "google",
    timeoutMs: 5000,
    limit: 100,
    concurrency: 2,
    delayMs: 0,
    robotsBody: robots,
    signal: new AbortController().signal,
  });

  strictEqual(report.pages.length, 0);
  strictEqual(report.skipped.length, 2);
  server.close();
});
