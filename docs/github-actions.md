# GitHub Actions

Workflows:

- `ci.yml`: Go format, Go tests, frontend builds, secret pattern guard.
- `docker.yml`: multi-arch GHCR image build and push.
- `release.yml`: tag release with compose examples and checksums.
- `upstream-check.yml`: scheduled upstream drift report.
- `security.yml`: secret patterns and Docker context/layer guard.

Docker workflow uses:

- `docker/setup-buildx-action`
- `linux/amd64,linux/arm64`
- `GITHUB_TOKEN`
- `packages: write`
- GHA cache

The workflows do not download upstream source zip files and do not run `git apply`.
