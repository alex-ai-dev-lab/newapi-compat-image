#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <new-api-source-dir> <compat-patch> <new-image-tag>"
  echo "Example: $0 /path/to/new-api-source /path/to/selected-compat-v6.patch new-api:compat-custom-$(date +%Y%m%d%H%M)"
  exit 2
fi

SRC_DIR="$(realpath "$1")"
PATCH_FILE="$(realpath "$2")"
NEW_IMAGE="$3"

if [ ! -f "$SRC_DIR/go.mod" ] || [ ! -f "$SRC_DIR/Dockerfile" ]; then
  echo "Source dir does not look like new-api source: $SRC_DIR" >&2
  exit 1
fi

if [ ! -f "$PATCH_FILE" ]; then
  echo "Patch file not found: $PATCH_FILE" >&2
  exit 1
fi

BUILD_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

cp -a "$SRC_DIR"/. "$BUILD_DIR"/

cd "$BUILD_DIR"
git apply --check "$PATCH_FILE"
git apply "$PATCH_FILE"

docker build -t "$NEW_IMAGE" .

echo "Built image: $NEW_IMAGE"
