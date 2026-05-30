# Windows wrapper for n8n Execute Command (PowerShell)
# Requires: STARDESK_REPO or run from repo with env set

$ErrorActionPreference = "Stop"
$repo = if ($env:STARDESK_REPO) { $env:STARDESK_REPO } else { Resolve-Path (Join-Path $PSScriptRoot "../..") }
Set-Location (Join-Path $repo "scripts/n8n-workflows")
& node run-quality-loop.mjs
exit $LASTEXITCODE
