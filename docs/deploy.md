# Deploy

Default compose uses SQLite when `SQL_DSN` is empty and persists:

- `/data`
- `/app/logs`
- `/app/public`

Deploy from Windows:

```powershell
.\scripts\deploy-server.ps1 -Image ghcr.io/alex-ai-dev-lab/renewapi:latest
```

Dry run:

```powershell
.\scripts\deploy-server.ps1 -Image ghcr.io/alex-ai-dev-lab/renewapi:latest -DryRun
```

Rollback:

```powershell
.\scripts\rollback-server.ps1
```

Server proxy for external pulls:

```text
SERVER_PROXY=http://127.0.0.1:10808
```

Existing root-owned volumes may need one-time permission repair:

```bash
sudo chown -R 1000:1000 data logs public
```

Temporarily keeping `user: "0:0"` is acceptable only for old volume permission migration, not the default.
