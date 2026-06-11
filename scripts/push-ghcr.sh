#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "$root/scripts/load-local-secrets.sh" github >/dev/null
: "${GITHUB_TOKEN:?GITHUB_TOKEN missing}"
: "${GITHUB_USERNAME:?GITHUB_USERNAME missing}"
registry="${GHCR_REGISTRY:-ghcr.io}"
owner="${GHCR_OWNER:-$GITHUB_USERNAME}"
name="${GHCR_IMAGE:-newapi-compat-image}"
image="${NEWAPI_IMAGE:-$registry/$owner/$name:latest}"
printf '%s' "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin >/dev/null
echo "GHCR auth loaded: yes"
docker push "$image"
