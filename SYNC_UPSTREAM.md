# Sync Upstream

Use merge mode on `main` so production releases can be traced to explicit upstream merge commits.

```bash
bash scripts/check-upstream.sh
bash scripts/sync-upstream.sh --merge --dry-run
bash scripts/sync-upstream.sh --merge
```

PowerShell:

```powershell
.\scripts\check-upstream.ps1
.\scripts\sync-upstream.ps1 -Mode merge -DryRun
.\scripts\sync-upstream.ps1 -Mode merge
```

Feature branches can use rebase:

```bash
bash scripts/sync-upstream.sh --rebase
```

If conflicts occur:

- Resolve files listed by Git.
- Prefer upstream behavior unless fork compatibility/security behavior is explicitly required.
- Run at least `go test ./relay/antipoison ./service ./model ./controller`.
- Rebuild frontend assets before Docker release.
