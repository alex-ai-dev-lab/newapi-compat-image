# Interface Zero — high-end home page (image build)

This adds a premium, scoped redesign of the public landing page at `/` for the patched NewAPI image. Five new section components plus a self-contained `.iz-*` CSS block in `src/styles/index.css`. No new npm dependencies, no React 19, no backend changes.

## What ships

New files:

- `web/default/src/features/home/components/sections/iz-hero.tsx`
- `web/default/src/features/home/components/sections/iz-pillars.tsx`
- `web/default/src/features/home/components/sections/iz-endpoints.tsx`
- `web/default/src/features/home/components/sections/iz-quickstart.tsx`
- `web/default/src/features/home/components/sections/iz-closing.tsx`

Edited:

- `web/default/src/features/home/index.tsx` — switches the default landing render path to the new `Iz*` sections wrapped in `<div className='iz-root'>`. Custom-content and loading branches are untouched, so the admin's "首页内容" override still works.
- `web/default/src/styles/index.css` — appends a single scoped `.iz-*` block at the end of the file.
- `web/default/src/components/layout/components/public-header.tsx` — site logo gets a subtle bordered/embossed badge container; site name uses a soft top-down gradient. Same height, same nav, same auth — visual polish only.
- `web/default/src/components/layout/components/footer.tsx` — tighter brand column with a "All systems operational" indicator, slimmer vertical rhythm, a hairline gradient under the top border. Non-demo deployments no longer leave a big empty middle gap.

Untouched: routing, auth, dashboard, console, settings, mobile menu behavior.

Visual behaviors:

- Hero with mouse-tracking spotlight, animated grid, cycling endpoint chip (`BASE URL + /v1/...`), copy-to-clipboard, status pill, stats row.
- Pillars: 4 product principles in a single bordered grid card.
- Endpoints: live-style cards for the 6 main protocol surfaces.
- Quickstart: one tabbed code block (cURL / Python / Node.js) with copy button; the BASE URL is bound to `window.location.origin` at render time.
- Closing: full-bleed CTA section.
- All `.iz-*` rules read from existing theme tokens (`--foreground`, `--background`, `--border`) via `color-mix(in oklab, ...)`, so light/dark themes both work without any extra config.
- Honors `prefers-reduced-motion`.

## Two ways to apply

Both produce the same image. Pick one.

### Option A — drop-in replacement of the compat patch (recommended)

`selected-compat-v7.patch` is `selected-compat-v6.patch` with the home redesign appended. Validated: applies cleanly to upstream `v1.0.0-rc.8`.

1. Replace the patch file in this repo:
   ```
   newapi-compat-image/selected-compat-v6.patch  →  selected-compat-v7.patch
   ```
2. Update the workflow to point at the new file. In `.github/workflows/build-release.yml`, change the two references:
   ```
   patch-repo/selected-compat-v6.patch
   ```
   to:
   ```
   patch-repo/selected-compat-v7.patch
   ```
   (Lines that currently reference `selected-compat-v6.patch`: `git apply --check`, `git apply`, the `grep` headers line, and the `cp` into `out/`.)
3. Update `deploy-newapi-compat.sh` callers to pass the new patch filename, or just rename `selected-compat-v6.patch` → `selected-compat-v7.patch` in the repo root.
4. Commit, push, run the `Build patched NewAPI release` workflow.

### Option B — keep v6, layer v7 on top

If you want to preserve `selected-compat-v6.patch` as-is and ship the home page as a separate, optional patch:

1. Drop `iz-home.patch` next to `selected-compat-v6.patch`.
2. In the workflow, after the existing `git apply ... selected-compat-v6.patch` line, add:
   ```bash
   if ! git apply --check "${GITHUB_WORKSPACE}/patch-repo/iz-home.patch"; then
     echo "::error::iz-home.patch does not apply cleanly to ${upstream_tag}."
     exit 1
   fi
   git apply "${GITHUB_WORKSPACE}/patch-repo/iz-home.patch"
   ```
3. Also `cp patch-repo/iz-home.patch out/` and add it to `sha256sum`/`upload_asset` so it lands in the release.

`iz-home.patch` is independent of the compat patch — they touch disjoint files, so order doesn't matter.

## Local build (sanity check)

```bash
chmod +x deploy-newapi-compat.sh

./deploy-newapi-compat.sh \
  /path/to/upstream/new-api-source \
  ./selected-compat-v7.patch \
  newapi-compat:iz-test \
  v1.0.0-rc.8
```

Then:

```bash
docker run --rm -p 3000:3000 -v ./data:/data newapi-compat:iz-test
```

Visit `http://localhost:3000/` while signed out (and again signed in) to verify both CTA states render, copy works, the endpoint chip cycles, and dark mode looks right.

## When upstream changes

The auto-build action will fail-fast if the patch no longer applies. The home redesign only touches:

- `web/default/src/features/home/index.tsx` (one import block + one return block)
- `web/default/src/styles/index.css` (append-only)
- 5 brand-new files under `web/default/src/features/home/components/sections/`

If `web/default/src/features/home/index.tsx` is restructured upstream, re-generate the diff against the new file, replace the matching hunk in `selected-compat-v7.patch` (or `iz-home.patch`), and you're done.

## Rollback

Revert the patch swap (point the workflow back at `selected-compat-v6.patch`) and rebuild. No DB migrations, no settings, no localStorage.
