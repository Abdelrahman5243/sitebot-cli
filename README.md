# sitebot

Fast, focused SEO and GEO auditing from your terminal.

Give sitebot one URL and get a useful report in seconds: HTTP status, redirects,
metadata, Open Graph, Twitter Cards, robots.txt, sitemap, llms.txt, hreflang,
structured data, content signals, and an SEO score.

It can also crawl the whole site from its sitemap, check every link for breakage,
measure Core Web Vitals, and validate structured data against Google's
rich-result requirements — with exit codes for CI.

## Requirements

- Node.js 22 or newer
- Chromium for `--render` mode

## Install

```bash
npm install -g sitebot-cli
sitebot https://example.com
```

Or run it once without installing globally:

```bash
npx sitebot-cli https://example.com
```

The package also exposes the `sitebot` command:

```bash
npx --package=sitebot-cli sitebot https://example.com
```

## Quick start

```bash
sitebot https://example.com
```

Run it with no flags and sitebot asks what to check, so you never have to
remember option names:

```bash
sitebot
```

The prompts turn themselves off automatically when there is no TTY or when `CI`
is set, so the same command works in a pipeline.

## Options

```text
-b, --bot <profile>       google or browser (default: google)
-t, --timeout <seconds>   per-request timeout (default: 10)
    --crawl               crawl the whole site from its sitemap
    --limit <pages>       maximum pages to crawl (default: 100)
    --concurrency <n>     parallel requests while crawling (default: 5)
    --links               check every link on the page for breakage
    --external-links      include links pointing to other domains
    --vitals              measure Core Web Vitals in Chromium
    --render              audit the browser-rendered HTML
    --no-schema           skip structured data validation
    --fail-on <level>     never, error, or warning (default: error)
    --min-score <score>   fail below this SEO score
    --max-seconds <n>     overall time budget (default: 300)
    --pages <paths>       audit comma-separated paths
-y, --yes                 accept prompts (installs Chromium if needed)
    --json                print machine-readable JSON
    --quiet               print only the final score
    --no-color            disable terminal colors
-V, --version             print the version
-h, --help                show help
```

Examples:

```bash
sitebot https://example.com --bot browser
sitebot https://example.com --timeout 20
sitebot https://example.com --json > report.json
sitebot https://example.com --quiet --no-color
sitebot https://example.com --pages "/,/about,/robots.txt"
sitebot https://example.com --render
sitebot https://example.com --crawl --limit 50
sitebot https://example.com --links --external-links
sitebot https://example.com --vitals
sitebot https://example.com --min-score 80 --fail-on warning
```

## Crawling a whole site

`--crawl` reads `robots.txt` for `Sitemap:` entries, falls back to
`/sitemap.xml` and `/sitemap_index.xml`, follows sitemap indexes, and audits
every page it finds:

```bash
sitebot https://example.com --crawl --limit 100 --concurrency 5
```

On top of the per-page checks it reports problems only a crawl can find:
duplicate titles, duplicate descriptions, missing titles and descriptions, the
lowest-scoring pages, and any page that errors.

sitebot stays inside the origin you gave it, skips paths that `robots.txt`
disallows, honours `Crawl-delay`, and stops at `--limit` pages and
`--max-seconds`. Ctrl+C ends the run and still prints the partial report.

## Broken links

```bash
sitebot https://example.com --links
```

Every link on the page is checked with `HEAD`, retrying with `GET` when a
server rejects `HEAD`. Internal links are checked by default; add
`--external-links` to include other domains.

## Core Web Vitals

```bash
sitebot https://example.com --vitals
```

Measures LCP, CLS, TBT, FCP, and TTFB in a real Chromium page, alongside the
request count, bytes transferred, and console errors. Each metric is graded
against Google's good / needs-improvement / poor thresholds.

These are lab measurements from your machine, so they reflect your network and
CPU rather than what real users see. Chromium is required, and sitebot asks
before downloading it.

## Structured data

Validates every JSON-LD node — including nodes inside `@graph` — against the
properties Google requires for rich results. Missing a required property is an
error, missing a recommended one is a warning.

```bash
sitebot https://example.com --no-schema   # skip it
```

## Using sitebot in CI

sitebot exits non-zero when a gate fails, so it works as a quality gate:

| Code | Meaning |
| ---- | ------------------------------------------- |
| 0    | all checks passed |
| 1    | a gate condition failed |
| 2    | invalid usage |
| 3    | runtime failure |

```yaml
- name: SEO audit
  run: npx sitebot-cli https://example.com --min-score 80 --fail-on error
```

`--fail-on error` (the default) fails on missing essentials, `--fail-on warning`
also fails on recommendations, and `--fail-on never` reports without failing.
`--min-score` adds a score floor.

## What it checks

### Page SEO

- Title and meta description presence and length
- Canonical URL
- H1 count
- Open Graph and Twitter Card tags

### Technical GEO

- robots.txt and whether the requested path is allowed
- sitemap.xml and llms.txt availability
- hreflang, HTML language, and viewport
- JSON-LD schema types
- Word count and image alt-text coverage

### HTTP

- Status and content type
- Response time
- Redirect chain
- X-Robots-Tag, cache-control, language, and server headers

## Understanding the report

`Meta Robots`, `X-Robots-Tag`, and `robots.txt` are different signals. A missing
meta robots tag does not mean the page is blocked. The report displays them
separately and evaluates the robots.txt rule for the requested path.

The score is a lightweight diagnostic score, not a Google ranking score. Warnings
are recommendations; errors indicate missing or invalid essentials. A non-zero
exit code is returned for HTTP failures or SEO errors, which makes JSON output
suitable for CI checks.

## Limitations

sitebot fetches the HTML delivered by the server. It does not execute JavaScript,
render a browser, or crawl the entire site automatically. Client-side content
may therefore be absent from the raw report. Use `--render` to compare raw HTML
with the browser-rendered DOM. The first use of `--render` asks for confirmation
with a Yes/No prompt; choose with the arrows or type `y`/`n`.
To install it manually in advance, use:

```bash
npx playwright install chromium
```

## Development

```bash
git clone https://github.com/Abdelrahman5243/sitebot-cli.git
cd sitebot-cli
npm install
npm run dev -- https://example.com
npm run check
npm test
npm run build
```

## Project structure

```text
src/cli.ts             command entrypoint
src/app.ts             application flow
src/options.ts         validation and prompts
src/http.ts            page fetch and redirects
src/robots-fetcher.ts  robots.txt fetch
src/parser.ts          HTML metadata extraction
src/seo.ts             SEO checks and score
src/robots.ts          robots.txt rule matching
src/site-checks.ts     technical GEO checks
src/multi.ts           small multi-page audit
src/report.ts          terminal and JSON output
src/types.ts           shared types
```

## Publishing

```bash
npm login
npm whoami
npm pack --dry-run
npm publish
```

`prepublishOnly` automatically runs typecheck, tests, and the production build.
Use `npm version patch`, `npm version minor`, or `npm version major` before a
new release.

## License

MIT. See [LICENSE](LICENSE).
