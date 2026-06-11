#!/usr/bin/env bash
set -euo pipefail

mode="merge"
dry_run="false"
while [ $# -gt 0 ]; do
  case "$1" in
    --merge) mode="merge"; shift ;;
    --rebase) mode="rebase"; shift ;;
    --dry-run) dry_run="true"; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done
remote="${UPSTREAM_REMOTE:-upstream}"
branch="${UPSTREAM_BRANCH:-main}"
git remote get-url "$remote" >/dev/null 2>&1 || git remote add "$remote" https://github.com/QuantumNous/new-api.git
git fetch "$remote" "$branch" --tags
echo "mode: $mode"
echo "target: $remote/$branch"
if [ "$dry_run" = "true" ]; then
  git merge-tree "$(git merge-base HEAD "$remote/$branch")" HEAD "$remote/$branch" >/dev/null
  echo "dry-run merge-tree completed"
  exit 0
fi
if [ "$mode" = "rebase" ]; then
  git rebase "$remote/$branch"
else
  git merge --no-ff "$remote/$branch"
fi
if command -v go >/dev/null 2>&1; then
  go test ./relay/antipoison ./service ./model ./controller
else
  echo "go not found; skipped minimal tests"
fi
