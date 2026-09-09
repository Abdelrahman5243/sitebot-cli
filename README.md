# sitebot

**Audit any website for SEO, GEO, Core Web Vitals, broken links, and structured
data — from your terminal.**

[![npm version](https://img.shields.io/npm/v/sitebot-cli.svg)](https://www.npmjs.com/package/sitebot-cli)
[![npm downloads](https://img.shields.io/npm/dm/sitebot-cli.svg)](https://www.npmjs.com/package/sitebot-cli)
[![CI](https://github.com/Abdelrahman5243/sitebot-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Abdelrahman5243/sitebot-cli/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/sitebot-cli.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/sitebot-cli.svg)](https://nodejs.org)

```bash
npx sitebot-cli https://example.com
```

No install, no config, no account.

![sitebot auditing a site from the terminal](https://raw.githubusercontent.com/Abdelrahman5243/sitebot-cli/master/demo.gif)

```text
Overview
  ┌───────────┬────────────────────────────┐
  │ Field     │ Value                      │
  ├───────────┼────────────────────────────┤
  │ URL       │ https://example.com/       │
  │ Status    │ 200 OK                     │
  │ Response  │ 486ms                      │
  │ Score     │ 88 / 100                   │
  └───────────┴────────────────────────────┘

SEO Checks
  ┌───┬────────────────────────┬──────────────────────────────┐
  │   │ Check                  │ Result                       │
  ├───┼────────────────────────┼──────────────────────────────┤
  │ ✓ │ Title                  │ Good length (40 characters). │
  │ ✗ │ Description            │ Missing.                     │
  │ ✓ │ Canonical              │ Tag is present.              │
  │ ✓ │ H1                     │ Exactly one H1 found.        │
  └───┴────────────────────────┴──────────────────────────────┘

Core Web Vitals
  ┌────────┬─────────────────┬────────────────┐
  │ Metric │ Mobile          │ Desktop        │
  ├────────┼─────────────────┼────────────────┤
  │ LCP    │ ✓ 1360ms (good) │ ✓ 888ms (good) │
  │ TBT    │ ✗ 1117ms (poor) │ ✓ 0ms (good)   │
  │ CLS    │ ✓ 0 (good)      │ ✓ 0 (good)     │
  └────────┴─────────────────┴────────────────┘
```

Run it with no arguments and it asks what to check:

```bash
npx sitebot-cli
```

## What it finds

Things that quietly cost you traffic, and that a browser will not show you:

- **Pages that serve bots something different from what you see.** A page
  returning `200` in your browser can return `503` to Googlebot. sitebot uses a
  real crawler user-agent, so you see what Google sees.
- **Duplicate titles and descriptions across the site**, which only a crawl can
  find.
- **Mobile performance problems hidden by a fast desktop.** Google ranks on the
  mobile result.
- **Structured data that silently loses rich results** because a required
  property is missing.
- **Broken links**, including ones behind servers that reject `HEAD`.

## Install

Run it directly, no install:

```bash
npx sitebot-cli https://example.com
```

Or install globally:

```bash
npm install -g sitebot-cli
sitebot https://example.com
```

Requires Node.js 22+. Chromium is only needed for `--vitals`, and sitebot asks
before downloading it.

## Options

```text
-b, --bot <profile>       google or browser (default: google)
-t, --timeout <seconds>   per-request timeout (default: 10)
    --crawl               crawl the whole site from its sitemap
    --limit <pages>       maximum pages to crawl (default: 100)
    --concurrency <n>     parallel requests while crawling (default: 5)
    --links               check every link on the page for breakage
    --external-links      include links pointing to other domains
    --vitals              measure Core Web Vitals on mobile and desktop
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

```bash
sitebot https://example.com --crawl --limit 50
sitebot https://example.com --links --external-links
sitebot https://example.com --vitals
sitebot https://example.com --min-score 80 --fail-on warning
sitebot https://example.com --json > report.json
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

Every link is checked with `HEAD`, retrying with `GET` when a server rejects
`HEAD`. Internal links are checked by default; add `--external-links` to
include other domains. Links that time out are reported separately from links
that are genuinely broken.

## Core Web Vitals

```bash
sitebot https://example.com --vitals
```

Measures LCP, CLS, TBT, FCP, and TTFB on **both mobile and desktop**, shown side
by side. Mobile is throttled to a mid-tier phone on 4G the way Lighthouse does
it, because Google ranks on the mobile result and an unthrottled desktop run
hides problems real visitors hit.

These are lab measurements from your machine, so they reflect your own network
rather than what real users see.

## Structured data

Validates every JSON-LD node — including nodes inside `@graph` — against the
properties Google requires for rich results. Missing a required property is an
error, missing a recommended one is a warning.

## Using sitebot in CI

sitebot exits non-zero when a gate fails, so it works as a quality gate:

| Code | Meaning |
| ---- | ----------------------------------------------- |
| 0    | all checks passed |
| 1    | a gate condition failed |
| 2    | invalid usage |
| 3    | runtime failure |
| 130  | the run was cancelled or ran out of time |

Prompts disable themselves when there is no TTY or when `CI` is set, so the same
command works locally and in a pipeline.

```yaml
- name: SEO audit
  run: npx sitebot-cli https://example.com --min-score 80 --fail-on error
```

`--fail-on error` (the default) fails on missing essentials, `--fail-on warning`
also fails on recommendations, and `--fail-on never` reports without failing.

### GitHub Action

There is also an action, which writes a table to the job summary and exposes
the score to later steps:

```yaml
- uses: Abdelrahman5243/sitebot-cli@v1
  with:
    url: https://example.com
    min-score: "80"
    crawl: "true"
    links: "true"
```

| Input | Default | Description |
| ---------------- | --------- | ------------------------------------------ |
| `url` | required | The URL to audit |
| `min-score` | — | Fail below this SEO score |
| `fail-on` | `error` | `never`, `error`, or `warning` |
| `crawl` | `false` | Crawl the whole site from its sitemap |
| `limit` | `100` | Maximum pages to crawl |
| `links` | `false` | Check every link for breakage |
| `vitals` | `false` | Measure Core Web Vitals (downloads Chromium) |
| `timeout` | `15` | Per-request timeout in seconds |
| `max-seconds` | `300` | Overall time budget |
| `report-path` | — | Write the full JSON report to this path |

Outputs: `score`, `passed`, and `broken-links`.

```yaml
- uses: Abdelrahman5243/sitebot-cli@v1
  id: seo
  with:
    url: https://example.com
    fail-on: never
- run: echo "Scored ${{ steps.seo.outputs.score }}"
```

## Understanding the report

`Meta Robots`, `X-Robots-Tag`, and `robots.txt` are different signals. A missing
meta robots tag does not mean the page is blocked. The report shows them
separately and evaluates the `robots.txt` rule for the requested path.

The score is a lightweight diagnostic score, not a Google ranking score.
Warnings are recommendations; errors indicate missing or invalid essentials.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
git clone https://github.com/Abdelrahman5243/sitebot-cli.git
cd sitebot-cli
npm install
npm test
npm run dev -- https://example.com
```

## License

[MIT](./LICENSE)
