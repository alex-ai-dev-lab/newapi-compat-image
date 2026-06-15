#!/usr/bin/env bash
set -euo pipefail

remote="${UPSTREAM_REMOTE:-upstream}"
branch="${UPSTREAM_BRANCH:-main}"
if ! git remote get-url "$remote" >/dev/null 2>&1; then
  echo "upstream remote exists: no"
  upstream_url="${UPSTREAM_REPOSITORY_URL:-https://github.com/QuantumNous/new-api.git}"
  git remote add "$remote" "$upstream_url"
  echo "added upstream remote: $upstream_url"
fi
echo "upstream remote exists: yes"
git fetch "$remote" "$branch:refs/remotes/$remote/$branch" --tags
if base="$(git merge-base HEAD "$remote/$branch")"; then
  diff_args=("$base" HEAD)
else
  echo "no common merge base with $remote/$branch; using empty tree for local diff diagnostics"
  base="$(git hash-object -t tree /dev/null)"
  diff_args=("$base" HEAD)
fi
echo "current base: $base"
echo "upstream latest: $(git rev-parse "$remote/$branch")"
echo "behind commits: $(git rev-list --count "HEAD..$remote/$branch")"
echo "custom diff stat:"
git diff --stat "${diff_args[@]}" -- . ':!legacy/patches/**'
echo "likely conflict files:"
git diff --name-only "${diff_args[@]}" -- . ':!legacy/patches/**' | sed -n '1,120p'
