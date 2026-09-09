#!/usr/bin/env bash
# Entry point for the sitebot GitHub Action. Builds the argument list from the
# action inputs, then hands the JSON report to summarize.mjs.
set -uo pipefail

# Reject anything that is not a plain http(s) URL. Without this a value
# starting with "-" would be read as a flag rather than a target.
case "$SITEBOT_URL" in
  http://* | https://*) ;;
  *)
    echo "::error::url must start with http:// or https://"
    exit 2
    ;;
esac

args=("$SITEBOT_URL" "--json" "--no-color")
args+=("--fail-on" "${SITEBOT_FAIL_ON:-error}")
args+=("--timeout" "${SITEBOT_TIMEOUT:-15}")
args+=("--max-seconds" "${SITEBOT_MAX_SECONDS:-300}")

[ -n "${SITEBOT_MIN_SCORE:-}" ] && args+=("--min-score" "$SITEBOT_MIN_SCORE")
[ "${SITEBOT_CRAWL:-false}" = "true" ] && args+=("--crawl" "--limit" "${SITEBOT_LIMIT:-100}")
[ "${SITEBOT_LINKS:-false}" = "true" ] && args+=("--links")
[ "${SITEBOT_VITALS:-false}" = "true" ] && args+=("--vitals" "--yes")

report="${SITEBOT_REPORT_PATH:-${RUNNER_TEMP:-/tmp}/sitebot-report.json}"
case "$report" in
  *..*)
    echo "::error::report-path must not contain '..'"
    exit 2
    ;;
esac
mkdir -p "$(dirname "$report")"

# Runs the published package pinned to this action's version, so the action
# never depends on a build step in the consumer's workflow.
version="$(node -p "require('$SITEBOT_ACTION_PATH/package.json').version")"
npx --yes "sitebot-cli@$version" "${args[@]}" > "$report"

if [ ! -s "$report" ]; then
  echo "::error::sitebot produced no report"
  exit 1
fi

node "$SITEBOT_ACTION_PATH/scripts/summarize.mjs" "$report" "$SITEBOT_URL"
