#!/usr/bin/env bash
# Cuts a release: bumps the version, tags it, and pushes. GitHub Actions then
# publishes to npm and moves the major tag.
#
#   npm run release            # patch: 1.3.0 -> 1.3.1
#   npm run release minor      # 1.3.0 -> 1.4.0
#   npm run release major      # 1.3.0 -> 2.0.0
set -euo pipefail

bump="${1:-patch}"

case "$bump" in
  patch | minor | major) ;;
  *)
    echo "Usage: npm run release [patch|minor|major]" >&2
    exit 2
    ;;
esac

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" != "master" ]; then
  echo "Releases are cut from master; you are on '$branch'." >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean. Commit or stash first." >&2
  exit 1
fi

git pull --ff-only origin master

echo "Verifying before release..."
npm run check
npm test
npm run build

# npm version writes package.json, commits, and creates the tag.
new="$(npm version "$bump" -m "chore: release %s")"
echo "Bumped to $new"

git push origin master
git push origin "$new"

cat <<EOF

Pushed $new.

Last step — create the GitHub release, which triggers the npm publish:

  https://github.com/Abdelrahman5243/sitebot-cli/releases/new?tag=$new

Everything after that is automatic: npm publish, provenance, and moving the
major tag so @v1 keeps working.
EOF
