# NewAPI Compat Source Fork

This repository is now a source fork of `QuantumNous/new-api`. The root tree is the NewAPI source tree and Docker builds from the current checkout directly.

Legacy patch artifacts from the previous patch-image workflow are retained under `legacy/patches/` for audit only. They are not used by Docker builds, CI, releases, or deployment scripts.

## What Changed

- Source-first fork based on upstream `QuantumNous/new-api` `v1.0.0-rc.10`.
- Dockerfile builds the local source directly; it no longer downloads upstream zip files or applies patches.
- GitHub Actions publish multi-arch GHCR images from this source tree.
- Runtime defaults to non-root with `PUID` / `PGID`.
- `/healthz` is the lightweight container healthcheck endpoint.
- Anti-poison policy is profile based:
  - channel `77`: `trusted`
  - channel `101`: `probation`
  - channel `94`: `quarantine`
- Real user requests no longer get canary text appended by default. Canary is reserved for probes.

## Docker

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  --build-arg VERSION=dev \
  --build-arg COMMIT_SHA="$(git rev-parse HEAD)" \
  --build-arg BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --build-arg UPSTREAM_REF=v1.0.0-rc.10 \
  -t ghcr.io/alex-ai-dev-lab/newapi-compat-image:dev .
```

For local single-arch testing:

```powershell
.\scripts\local-build.ps1 -Image ghcr.io/alex-ai-dev-lab/newapi-compat-image:dev -Load
```

## Compose

```bash
cp .env.example .env
docker compose -f compose.yaml up -d
curl -fsS http://127.0.0.1:3002/healthz
```

SQLite is the default self-hosting path when `SQL_DSN` is empty. MySQL/Postgres examples are documented in `compose.yaml` and `docs/deploy.md`.

## GHCR

GitHub Actions uses the built-in `GITHUB_TOKEN` for GHCR. Local push scripts load credentials from `Token/github-auth.env` without printing secret values:

```powershell
.\scripts\push-ghcr.ps1 -Image ghcr.io/alex-ai-dev-lab/newapi-compat-image:dev
```

## Deploy

Local secret files are read from `Token/` and must not be committed.

```powershell
.\scripts\deploy-server.ps1 -Image ghcr.io/alex-ai-dev-lab/newapi-compat-image:latest
.\scripts\rollback-server.ps1
```

Local external network proxy: `http://127.0.0.1:3067`.
Server external network proxy: `http://127.0.0.1:10808` via `SERVER_PROXY`.

## Upstream Sync

Use merge commits on `main`:

```bash
bash scripts/check-upstream.sh
bash scripts/sync-upstream.sh --merge --dry-run
bash scripts/sync-upstream.sh --merge
```

Feature branches may rebase if useful.

## More Docs

- `UPSTREAM.md`
- `SYNC_UPSTREAM.md`
- `SECURITY.md`
- `docs/docker.md`
- `docs/deploy.md`
- `docs/anti-poison.md`
- `docs/channel-risk-profiles.md`
- `docs/evidence.md`
- `docs/github-actions.md`
- `docs/migration-from-patch-repo.md`
- `docs/local-secrets.md`
