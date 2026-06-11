$ErrorActionPreference = 'Stop'
$remote = if ($env:UPSTREAM_REMOTE) { $env:UPSTREAM_REMOTE } else { 'upstream' }
$branch = if ($env:UPSTREAM_BRANCH) { $env:UPSTREAM_BRANCH } else { 'main' }
git remote get-url $remote *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "upstream remote exists: no"
  throw "Add it with: git remote add upstream https://github.com/QuantumNous/new-api.git"
}
Write-Host "upstream remote exists: yes"
git fetch $remote $branch --tags
$base = git merge-base HEAD "$remote/$branch"
Write-Host "current base: $base"
Write-Host "upstream latest: $(git rev-parse "$remote/$branch")"
Write-Host "behind commits: $(git rev-list --count "HEAD..$remote/$branch")"
Write-Host "custom diff stat:"
git diff --stat "$base..HEAD" -- . ':!legacy/patches/**'
Write-Host "likely conflict files:"
git diff --name-only "$base..HEAD" -- . ':!legacy/patches/**' | Select-Object -First 120
