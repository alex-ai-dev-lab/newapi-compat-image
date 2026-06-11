#!/bin/sh
set -eu

hits="$(git grep -nE 'git apply|codeload.github.com|archive/refs/tags' -- \
  .github/workflows Dockerfile \
  ':!scripts/patch-workflow-guard.sh' \
  ':!.github/workflows/ci.yml' || true)"

if [ -n "$hits" ]; then
  printf '%s\n' "$hits" >&2
  exit 1
fi
