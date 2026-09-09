# Contributing

Thanks for taking the time to help.

## Getting started

```bash
git clone https://github.com/Abdelrahman5243/sitebot-cli.git
cd sitebot-cli
npm install
npm test
npm run dev -- https://example.com
```

Node.js 22 or newer is required.

## Before opening a pull request

```bash
npm run check   # TypeScript
npm test        # unit and integration tests
npm run build   # bundle
```

All three run in CI on Node 22 and 24, so a green local run usually means a
green PR.

## Guidelines

- **Keep the output honest.** A check should only report a problem it can
  actually prove. A request that times out is reported as unreachable, not as
  broken, because those are different findings.
- **Stay polite to the sites being audited.** Crawling must respect
  `robots.txt`, stay on the same origin, honour `Crawl-delay`, and obey the
  concurrency and page limits.
- **Add a test for new behaviour.** Tests in `test/` run against a local HTTP
  server rather than the public internet, so they stay fast and deterministic.
- **Match the surrounding style.** Small functions, clear names, and comments
  only where the reason is not obvious from the code.

## Reporting a bug

Include the command you ran, what you expected, and what happened. If the site
is public, the URL helps a lot — most bugs here are about how one specific site
responds.
