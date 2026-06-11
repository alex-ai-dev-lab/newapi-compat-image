#!/usr/bin/env bash
set -euo pipefail

remote="${UPSTREAM_REMOTE:-upstream}"
branch="${UPSTREAM_BRANCH:-main}"
if ! git remote get-url "$remote" >/dev/null 2>&1; then
  echo "upstream remote exists: no"
  echo "Add it with: git remote add upstream https://github.com/QuantumNous/new-api.git"
  exit 1
fi
echo "upstream remote exists: yes"
git fetch "$remote" "$branch" --tags
base="$(git merge-base HEAD "$remote/$branch")"
echo "current base: $base"
echo "upstream latest: $(git rev-parse "$remote/$branch")"
echo "behind commits: $(git rev-list --count "HEAD..$remote/$branch")"
echo "custom diff stat:"
git diff --stat "$base"..HEAD -- . ':!legacy/patches/**'
echo "likely conflict files:"
git diff --name-only "$base"..HEAD -- . ':!legacy/patches/**' | sed -n '1,120p'
