# Upstream

- Upstream repository: `QuantumNous/new-api`
- Baseline tag: `v1.0.0-rc.11`
- Baseline commit: `74985fa877b4a85decdf31044b2435cf688af395`
- Sync strategy for `main`: merge upstream, do not long-term rebase production history.

## Fork Scope

This fork keeps NewAPI upstream layout and adds compatibility/security work mainly in:

- `relay/antipoison/`
- `pkg/compat/`
- `service/*compat*`
- `controller/*compat*`
- `web/default/src/features/system-settings/`
- `scripts/`
- `.github/workflows/`

## Likely Conflict Areas

- `relay/channel/openai/*`
- `relay/compatible_handler.go`
- `relay/responses_handler.go`
- `relay/claude_handler.go`
- `service/channel_select.go`
- `dto/channel_settings.go`
- `setting/operation_setting/*`
- `web/default/src/features/system-settings/*`

## Diff Commands

```bash
git fetch upstream --tags
git diff --stat "$(git merge-base HEAD upstream/main)"..HEAD -- . ':!legacy/patches/**'
git diff --name-only "$(git merge-base HEAD upstream/main)"..HEAD -- . ':!legacy/patches/**'
```
