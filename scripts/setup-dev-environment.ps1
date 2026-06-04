#Requires -Version 7.0
<#
.SYNOPSIS
  Bootstrap local STARDESK dev environment on Windows.

.EXAMPLE
  pwsh -File scripts/setup-dev-environment.ps1
  pwsh -File scripts/setup-dev-environment.ps1 -SkipDb
#>
param(
    [switch]$SkipDb,
    [switch]$LocalPostgres
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib/windows-dev.ps1")

$RepoRoot = Get-StardeskRepoRoot -StartDir $PSScriptRoot
$ApiDir = Join-Path $RepoRoot "apps\api"
$WebDir = Join-Path $RepoRoot "apps\web"

Write-Host "==> Installing dependencies"
Push-Location $WebDir
try {
    & npm ci --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed in apps/web" }
}
finally {
    Pop-Location
}

Repair-StardeskApiVenv -ApiDir $ApiDir -Force

Write-Host "==> Environment files"
$apiEnv = Join-Path $ApiDir ".env"
$webEnv = Join-Path $WebDir ".env.local"
if (-not (Test-Path -LiteralPath $apiEnv)) {
    Copy-Item (Join-Path $ApiDir ".env.development.example") $apiEnv
    Write-Host "    Created apps/api/.env"
}
if (-not (Test-Path -LiteralPath $webEnv)) {
    Copy-Item (Join-Path $WebDir ".env.development.example") $webEnv
    Write-Host "    Created apps/web/.env.local"
}

if (-not $SkipDb) {
    $bootstrapArgs = @("--no-write-env")
    if ($LocalPostgres -or -not $env:DATABASE_URL) {
        $bootstrapArgs += "--local-postgres"
        Write-Host "==> Database bootstrap (local PostgreSQL)"
    }
    else {
        Write-Host "==> Database bootstrap (Neon DATABASE_URL from environment)"
    }
    Invoke-StardeskBashScript -RepoRoot $RepoRoot -RelativeScript "scripts/bootstrap-dev-database.sh" @bootstrapArgs
}

Write-Host "==> API unit tests"
Import-StardeskDotEnv -Path $apiEnv
Push-Location $ApiDir
try {
    & (Get-StardeskApiVenvPytest -ApiDir $ApiDir) -q --tb=no
    if ($LASTEXITCODE -ne 0) { throw "pytest failed" }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Done. This is LOCAL DEVELOPMENT — not production."
Write-Host "  Start servers: pwsh -File scripts/dev-up.ps1"
Write-Host "  Gate:          pwsh -File scripts/run-deliverable-gate.ps1"
Write-Host "  Web:  http://localhost:3000"
Write-Host "  API:  http://localhost:8000/health"
if (-not $SkipDb) {
    Write-Host "  Prototype users (from database):"
    Push-Location $ApiDir
    try {
        & (Get-StardeskApiVenvPython -ApiDir $ApiDir) (Join-Path $RepoRoot "scripts/list_prototype_users.py")
    } finally {
        Pop-Location
    }
}
