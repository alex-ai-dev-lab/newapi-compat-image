param([ValidateSet('merge','rebase')][string]$Mode = 'merge', [switch]$DryRun)
$ErrorActionPreference = 'Stop'
$remote = if ($env:UPSTREAM_REMOTE) { $env:UPSTREAM_REMOTE } else { 'upstream' }
$branch = if ($env:UPSTREAM_BRANCH) { $env:UPSTREAM_BRANCH } else { 'main' }
git remote get-url $remote *> $null
if ($LASTEXITCODE -ne 0) { git remote add $remote https://github.com/QuantumNous/new-api.git }
git fetch $remote $branch --tags
Write-Host "mode: $Mode"
Write-Host "target: $remote/$branch"
if ($DryRun) {
  $base = git merge-base HEAD "$remote/$branch"
  git merge-tree $base HEAD "$remote/$branch" *> $null
  Write-Host "dry-run merge-tree completed"
  exit 0
}
if ($Mode -eq 'rebase') { git rebase "$remote/$branch" } else { git merge --no-ff "$remote/$branch" }
if (Get-Command go -ErrorAction SilentlyContinue) {
  go test ./relay/antipoison ./service ./model ./controller
} else {
  Write-Host "go not found; skipped minimal tests"
}
