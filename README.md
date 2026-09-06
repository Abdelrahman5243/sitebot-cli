# sitebot

Fast terminal SEO checker.

## Structure

```text
src/
  cli.ts             command entrypoint
  app.ts             application flow
  options.ts         validation and prompts
  http.ts            page fetch and redirects
  robots-fetcher.ts  robots.txt fetch
  parser.ts          HTML metadata extraction
  seo.ts             SEO checks and score
  robots.ts          robots.txt rule matching
  report.ts          terminal and JSON output
  types.ts           shared types
```

Each source file is intentionally kept under 50 lines and has one main responsibility.

## Development

```bash
npm install
npm run dev -- https://example.com
```

Choose the user-agent profile and timeout:

```bash
npm run dev -- https://example.com --bot google --timeout 10
npm run dev -- https://example.com --bot browser
npm run dev -- https://example.com --json
npm run dev -- https://example.com --quiet --no-color
npm run dev -- https://example.com --pages "/,/arabic/about-us,/robots.txt"
```

The report includes HTTP details and basic HTML metadata: title, description,
canonical, robots, and H1 headings. Running without a URL starts an interactive
prompt flow for the URL and bot profile.

Run checks and tests:

```bash
npm run check
npm test
```

The JSON output includes HTTP data, redirects, selected headers, HTML metadata,
Open Graph/Twitter tags, robots.txt status, and SEO checks. The process exits
with a non-zero code when the response fails or an SEO error is found.

Technical GEO checks include sitemap.xml, llms.txt, hreflang, language,
viewport, JSON-LD types, content size, and image alt coverage. `--pages` accepts
a comma-separated list of paths for a small multi-page audit.

When no URL is provided, sitebot opens an interactive prompt.

```bash
npm run dev
```

## Phase 1 commands

```bash
npm run dev -- --help
npm run dev -- --version
```
