#!/usr/bin/env bash
# Builds the website and publishes dist/ to the gh-pages branch, which GitHub Pages serves at
# https://weijielee04.github.io/ringgit-log/. Run it from main after committing your changes.
# Needs git, python3 and node.
set -euo pipefail
cd "$(dirname "$0")"
bash build.sh
from=$(git rev-parse --short HEAD)
work=$(mktemp -d)
cleanup() { git worktree remove --force "$work" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT

if git fetch -q origin gh-pages 2>/dev/null; then
  git worktree add -q --detach "$work" FETCH_HEAD
else
  git worktree add -q --detach "$work"
  git -C "$work" checkout -q --orphan gh-pages
  git -C "$work" rm -rfq --cached . >/dev/null
fi
find "$work" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R dist/. "$work/"
git -C "$work" add -A
if git -C "$work" diff --cached --quiet; then
  echo "The site is already up to date."
  exit 0
fi
git -C "$work" commit -q -m "Publish the site from $from" ${PUBLISH_NOTE:+-m "$PUBLISH_NOTE"}
git -C "$work" push -q origin HEAD:refs/heads/gh-pages
echo "Published. GitHub Pages usually shows the new version within a couple of minutes."
