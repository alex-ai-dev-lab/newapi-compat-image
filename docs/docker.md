# Docker

The Dockerfile builds directly from the current source checkout.

Stages:

- `frontend-builder`: builds `web/default` and `web/classic`.
- `backend-builder`: downloads Go modules with BuildKit cache and builds `/app/new-api`.
- `runtime`: Alpine runtime with CA certificates, curl healthcheck, `newapi` user, and no source tree.

Build args:

- `VERSION`
- `COMMIT_SHA`
- `BUILD_DATE`
- `UPSTREAM_REF`

Local build:

```powershell
.\scripts\local-build.ps1 -Image ghcr.io/alex-ai-dev-lab/renewapi:dev -Load
```

Multi-arch push:

```bash
VERSION=v1.0.0 ./scripts/local-build.sh --push
```

Healthcheck:

```bash
curl -fsS http://127.0.0.1:3002/healthz
```
