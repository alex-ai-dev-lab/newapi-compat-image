#!/bin/sh
set -eu

pattern='github_pat_|ghp_[A-Za-z0-9_]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}'

hits="$(git grep -nE "$pattern" -- . \
  ':!docs/**' \
  ':!legacy/patches/**' \
  ':!.github/workflows/ci.yml' \
  ':!.github/workflows/security.yml' \
  ':!scripts/secret-scan.sh' \
  ':!relay/antipoison/guard_test.go' || true)"

if [ -n "$hits" ]; then
  printf '%s\n' "$hits" >&2
  exit 1
fi
