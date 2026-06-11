param(
  [ValidateSet('github','server','all')]
  [string]$Kind = 'all',
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

function Import-EnvFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Required env file not found: $Path"
  }
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq '' -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }
    $name = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

$tokenDir = Join-Path $Root 'Token'
if ($Kind -eq 'github' -or $Kind -eq 'all') {
  Import-EnvFile (Join-Path $tokenDir 'github-auth.env')
  Write-Host "GitHub auth loaded: yes"
}
if ($Kind -eq 'server' -or $Kind -eq 'all') {
  Import-EnvFile (Join-Path $tokenDir 'server-access.env')
  Write-Host "Server access loaded: yes"
}
