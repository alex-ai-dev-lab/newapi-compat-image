#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dry_run="false"
allow_password="false"
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) dry_run="true"; shift ;;
    --allow-password-auth) allow_password="true"; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done
# shellcheck source=/dev/null
source "$root/scripts/load-local-secrets.sh" server >/dev/null
: "${SERVER_HOST:?SERVER_HOST missing}"
: "${SERVER_USER:?SERVER_USER missing}"
: "${SERVER_DEPLOY_DIR:?SERVER_DEPLOY_DIR missing}"
SERVER_PORT="${SERVER_PORT:-22}"
SERVER_COMPOSE_FILE="${SERVER_COMPOSE_FILE:-compose.yaml}"
SERVER_SERVICE_NAME="${SERVER_SERVICE_NAME:-new-api}"
ssh_args=(-p "$SERVER_PORT" -o StrictHostKeyChecking=accept-new)
if [ "${SSH_AUTH_METHOD:-key}" = "password" ]; then
  [ "$allow_password" = "true" ] || { echo "Password SSH requested. Re-run with --allow-password-auth." >&2; exit 2; }
  export SSHPASS="${SERVER_PASSWORD:-}"
elif [ -n "${SSH_KEY_PATH:-}" ]; then
  ssh_args+=(-i "$SSH_KEY_PATH")
fi
remote="set -eu; cd '$SERVER_DEPLOY_DIR'; previous=\$(cat backups/previous-image.txt); NEWAPI_IMAGE=\"\$previous\" docker compose -f '$SERVER_COMPOSE_FILE' up -d --no-deps '$SERVER_SERVICE_NAME'; docker compose -f '$SERVER_COMPOSE_FILE' ps '$SERVER_SERVICE_NAME'"
[ "$dry_run" = "true" ] && { echo "DRY-RUN rollback prepared for $SERVER_USER@$SERVER_HOST"; exit 0; }
if [ "${SSH_AUTH_METHOD:-key}" = "password" ]; then
  sshpass -e ssh "${ssh_args[@]}" "$SERVER_USER@$SERVER_HOST" "$remote"
else
  ssh "${ssh_args[@]}" "$SERVER_USER@$SERVER_HOST" "$remote"
fi
