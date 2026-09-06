# sitebot

Fast, focused SEO and GEO auditing from your terminal.

Give sitebot one URL and get a useful report in seconds: HTTP status, redirects,
metadata, Open Graph, Twitter Cards, robots.txt, sitemap, llms.txt, hreflang,
structured data, content signals, and an SEO score.

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

The package also exposes the `sitebot` command:

```bash
npx --package=sitebot-cli sitebot https://example.com
```
```

## Quick start

```bash
sitebot https://example.com
```

Without a URL, sitebot opens prompts for the URL and bot profile:

```bash
sitebot
```

## Options

```text
-b, --bot <profile>       google or browser (default: google)
-t, --timeout <seconds>   request timeout (default: 10)
    --json                print machine-readable JSON
    --quiet               print only the final score
    --no-color             disable terminal colors
    --pages <paths>        audit comma-separated paths
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
```

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
