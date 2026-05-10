param(
  [Parameter(Mandatory = $true)]
  [string]$Token,

  [string]$Org = "alex-ai-dev-lab",
  [string]$Repo = "newapi-compat-image",
  [string]$Description = "Patched NewAPI image with Claude Code, Codex, Responses and channel-test compatibility fixes."
)

$ErrorActionPreference = "Stop"

$headers = @{
  Authorization          = "Bearer $Token"
  Accept                 = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

$repoUrl = "https://api.github.com/repos/$Org/$Repo"
$createUrl = "https://api.github.com/orgs/$Org/repos"

try {
  Invoke-RestMethod -Method Get -Uri $repoUrl -Headers $headers | Out-Null
  Write-Host "Repository already exists: https://github.com/$Org/$Repo"
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  if ($status -ne 404) {
    throw
  }

  $body = @{
    name                  = $Repo
    description           = $Description
    private               = $false
    has_issues            = $true
    has_projects          = $false
    has_wiki              = $false
    auto_init             = $false
    delete_branch_on_merge = $true
  } | ConvertTo-Json

  Invoke-RestMethod -Method Post -Uri $createUrl -Headers $headers -Body $body -ContentType "application/json" | Out-Null
  Write-Host "Created repository: https://github.com/$Org/$Repo"
}

if (git remote get-url origin 2>$null) {
  git remote remove origin
}
git remote add origin "https://x-access-token:$Token@github.com/$Org/$Repo.git"
git branch -M main
git push -u origin main
git remote set-url origin "https://github.com/$Org/$Repo.git"

Write-Host "Pushed main branch."
Write-Host "Repository: https://github.com/$Org/$Repo"
