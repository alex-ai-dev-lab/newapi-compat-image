# Migration From Patch Repo

Previous build path:

1. Download `QuantumNous/new-api` upstream zip.
2. Apply `newapi-runtime-compat.patch` or `newapi-runtime-compat-with-homepage.patch`.
3. Build image from patched temp tree.
4. Publish tar.gz release assets.

New build path:

1. Build directly from this source fork.
2. Publish multi-arch GHCR image.
3. Release compose examples and checksums.

Legacy patches are retained in `legacy/patches/` only for audit and historical comparison.
