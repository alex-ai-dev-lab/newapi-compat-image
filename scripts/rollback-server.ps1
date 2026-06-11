param([switch]$DryRun, [switch]$AllowPasswordAuth)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'load-local-secrets.ps1') -Kind server
$hostName = $env:SERVER_HOST
$port = if ($env:SERVER_PORT) { $env:SERVER_PORT } else { '22' }
$user = $env:SERVER_USER
$deployDir = $env:SERVER_DEPLOY_DIR
$composeFile = if ($env:SERVER_COMPOSE_FILE) { $env:SERVER_COMPOSE_FILE } else { 'compose.yaml' }
$service = if ($env:SERVER_SERVICE_NAME) { $env:SERVER_SERVICE_NAME } else { 'new-api' }
if (-not $hostName -or -not $user -or -not $deployDir) { throw "SERVER_HOST, SERVER_USER, SERVER_DEPLOY_DIR are required" }
$sshBase = @('-p', $port, '-o', 'StrictHostKeyChecking=accept-new')
if ($env:SSH_KEY_PATH -and $env:SSH_AUTH_METHOD -ne 'password') { $sshBase += @('-i', $env:SSH_KEY_PATH) }
if ($env:SSH_AUTH_METHOD -eq 'password' -and -not $AllowPasswordAuth) { throw "Password SSH requested. Re-run with -AllowPasswordAuth." }
$script = "set -eu; cd '$deployDir'; previous=`$(cat backups/previous-image.txt); NEWAPI_IMAGE=`$previous docker compose -f '$composeFile' up -d --no-deps '$service'; docker compose -f '$composeFile' ps '$service'"
if ($DryRun) { Write-Host "DRY-RUN rollback prepared for $user@$hostName"; exit 0 }
if ($env:SSH_AUTH_METHOD -eq 'password') { $env:SSHPASS = $env:SERVER_PASSWORD; sshpass -e ssh @sshBase "$user@$hostName" $script } else { ssh @sshBase "$user@$hostName" $script }
