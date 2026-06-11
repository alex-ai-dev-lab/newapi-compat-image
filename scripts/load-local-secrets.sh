#!/usr/bin/env bash
set -euo pipefail

kind="${1:-all}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

load_env_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "Required env file not found: $file" >&2
    exit 1
  fi
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [ -z "$line" ] && continue
    case "$line" in \#*) continue ;; esac
    case "$line" in
      *=*)
        name="${line%%=*}"
        value="${line#*=}"
        name="${name//[[:space:]]/}"
        value="${value#"${value%%[![:space:]]*}"}"
        value="${value%"${value##*[![:space:]]}"}"
        case "$value" in
          \"*\") value="${value:1:${#value}-2}" ;;
          \'*\') value="${value:1:${#value}-2}" ;;
        esac
        export "$name=$value"
        ;;
    esac
  done < "$file"
}

case "$kind" in
  github)
    load_env_file "$root/Token/github-auth.env"
    echo "GitHub auth loaded: yes"
    ;;
  server)
    load_env_file "$root/Token/server-access.env"
    echo "Server access loaded: yes"
    ;;
  all)
    load_env_file "$root/Token/github-auth.env"
    echo "GitHub auth loaded: yes"
    load_env_file "$root/Token/server-access.env"
    echo "Server access loaded: yes"
    ;;
  *)
    echo "Usage: $0 [github|server|all]" >&2
    exit 2
    ;;
esac
