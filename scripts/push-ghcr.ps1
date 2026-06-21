param([string]$Image = $env:NEWAPI_IMAGE)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'load-local-secrets.ps1') -Kind github
if (-not $env:GITHUB_TOKEN -or -not $env:GITHUB_USERNAME) { throw "GITHUB_TOKEN or GITHUB_USERNAME missing" }
if (-not $Image) {
  $registry = if ($env:GHCR_REGISTRY) { $env:GHCR_REGISTRY } else { "ghcr.io" }
  $owner = if ($env:GHCR_OWNER) { $env:GHCR_OWNER } else { $env:GITHUB_USERNAME }
  $name = if ($env:GHCR_IMAGE) { $env:GHCR_IMAGE } else { "renewapi" }
  $Image = "$registry/$owner/$name:latest"
}
$env:GITHUB_TOKEN | docker login ghcr.io -u $env:GITHUB_USERNAME --password-stdin | Out-Null
Write-Host "GHCR auth loaded: yes"
docker push $Image
