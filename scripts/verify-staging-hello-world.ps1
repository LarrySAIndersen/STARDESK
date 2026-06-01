#Requires -Version 7.0
<#
.SYNOPSIS
  Verify staging Vercel Preview API and run hello-world gate when DATABASE_URL is configured.

.EXAMPLE
  pwsh -File scripts/verify-staging-hello-world.ps1
  pwsh -File scripts/verify-staging-hello-world.ps1 -ApiUrl https://api-git-staging-kjaerby-1628s-projects.vercel.app
#>
param(
    [string]$ApiUrl = "https://api-git-staging-kjaerby-1628s-projects.vercel.app",
    [string]$Email = "sf01@example.dk",
    [string]$Password = "Stardesk2026!",
    [string]$VercelShareUrl
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib/windows-dev.ps1")

$ApiUrl = $ApiUrl.TrimEnd("/")
$Doc = "docs/staging-vercel-preview-env.md"
$Session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()

if ($VercelShareUrl) {
    try {
        Invoke-WebRequest -Uri $VercelShareUrl -WebSession $Session -UseBasicParsing | Out-Null
    }
    catch {
        Write-Host "Note: Vercel share URL returned $($_.Exception.Message); using vercel curl fallback if needed." -ForegroundColor Yellow
    }
}

function Write-Fail([string]$Message) {
    Write-Host "GATE FAIL: $Message" -ForegroundColor Red
    exit 1
}

function Write-Ok([string]$Message) {
    Write-Host "GATE OK: $Message" -ForegroundColor Green
}

Write-Host "=============================================="
Write-Host " STARDESK staging hello-world verification"
Write-Host " API: $ApiUrl"
Write-Host "=============================================="

Write-Host ""
Write-Host "==> Health"
try {
    $health = Invoke-StardeskApiRequest -ApiUrl $ApiUrl -Path "/health" -Method GET -WebSession $Session
}
catch {
    Write-Fail "GET /health failed. Is staging deployed with DATABASE_URL? See $Doc"
}

$stardeskEnv = [string]$health.stardesk_env
Write-Host "    stardesk_env=$stardeskEnv app_env=$($health.app_env) deployment=$($health.deployment)"

if ($stardeskEnv -eq "production") {
    Write-Fail "stardesk_env=production — wrong target for staging gate"
}

Write-Host ""
Write-Host "==> Login probe ($Email)"
$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json -Compress
try {
    $login = Invoke-StardeskApiRequest -ApiUrl $ApiUrl -Path "/api/v1/auth/login" -Method POST `
        -BodyJson $loginBody -WebSession $Session
}
catch {
    $detail = $_.ErrorDetails.Message
    if ($detail -match "Database is not configured") {
        Write-Host ""
        Write-Host "Staging API has no DATABASE_URL in Vercel Preview env." -ForegroundColor Yellow
        Write-Host "Fix: $Doc" -ForegroundColor Yellow
        Write-Fail "DATABASE_URL missing on Vercel Preview (see $Doc)"
    }
    Write-Fail "POST /api/v1/auth/login failed: $detail"
}

$token = [string]$login.access_token
if (-not $token) {
    Write-Fail "No access_token in login response"
}
Write-Ok "Login as $Email"

Write-Host ""
Write-Host "==> Tickets"
$headers = @{ Authorization = "Bearer $token" }
$tickets = Invoke-StardeskApiRequest -ApiUrl $ApiUrl -Path "/api/v1/tickets?page=1&page_size=5" `
    -Method GET -Headers $headers -WebSession $Session
$count = 0
if ($tickets -is [System.Array]) { $count = $tickets.Count }
elseif ($tickets.items) { $count = @($tickets.items).Count }
elseif ($tickets.data) { $count = @($tickets.data).Count }

if ($count -lt 1) {
    Write-Fail "Expected >= 1 ticket (got $count). Seed Neon test: bash scripts/bootstrap-dev-database.sh"
}
Write-Ok "Tickets listed (count=$count)"

Write-Host ""
Write-Host "=============================================="
Write-Host " STAGING HELLO-WORLD GATE PASSED"
Write-Host " Target: $ApiUrl"
Write-Host "=============================================="
