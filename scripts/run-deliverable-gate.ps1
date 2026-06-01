#Requires -Version 7.0
<#
.SYNOPSIS
  Mandatory deliverable gate for Windows (PowerShell native).

.EXAMPLE
  pwsh -File scripts/run-deliverable-gate.ps1
  pwsh -File scripts/run-deliverable-gate.ps1 -Full
  pwsh -File scripts/run-deliverable-gate.ps1 -SkipTests
#>
param(
    [switch]$Full,
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib/windows-dev.ps1")

$RepoRoot = Get-StardeskRepoRoot -StartDir $PSScriptRoot
$ApiDir = Join-Path $RepoRoot "apps\api"
$ApiEnv = Join-Path $ApiDir ".env"
$ApiUrl = if ($env:STARDESK_API_URL) { $env:STARDESK_API_URL.TrimEnd("/") } else { "http://localhost:8000" }

function Write-GateFail {
    param([string]$Message)
    Write-Host "GATE FAIL: $Message" -ForegroundColor Red
    exit 1
}

function Write-GateOk {
    param([string]$Message)
    Write-Host "GATE OK: $Message" -ForegroundColor Green
}

Write-Host "=============================================="
Write-Host " STARDESK deliverable gate (hello-world)"
Write-Host "=============================================="

Repair-StardeskApiVenv -ApiDir $ApiDir
Import-StardeskDotEnv -Path $ApiEnv

if (-not $SkipTests) {
    Write-Host ""
    Write-Host "==> API unit tests (quick)"
    Push-Location $ApiDir
    try {
        & uv run pytest -q --tb=line
        if ($LASTEXITCODE -ne 0) {
            throw "pytest failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "==> Hello-world gate (API) — $ApiUrl"

try {
    $env:TEST_USER_PASSWORD = Get-StardeskPrototypeDemoPassword -RepoRoot $RepoRoot
}
catch {
    Write-GateFail $_.Exception.Message
}

try {
    $health = Invoke-RestMethod -Uri "$ApiUrl/health" -Method Get -TimeoutSec 10 -ErrorAction Stop
}
catch {
    Write-GateFail "GET /health failed (is API running on $ApiUrl?). Start: pwsh -File scripts/dev-up.ps1"
}
$stardeskEnv = [string]$health.stardesk_env
$appEnv = [string]$health.app_env
$deployment = [string]$health.deployment
Write-Host "    health: stardesk_env=$stardeskEnv app_env=$appEnv deployment=$deployment"

if ($stardeskEnv -eq "production") {
    Write-GateFail "stardesk_env=production — use local/test target (see docs/deliverable-gate.md)"
}

$email = if ($env:TEST_USER_EMAIL) { $env:TEST_USER_EMAIL } else { "sf01@example.dk" }
$loginBody = @{
    email    = $email
    password = $env:TEST_USER_PASSWORD
} | ConvertTo-Json -Compress

try {
    $login = Invoke-RestMethod -Uri "$ApiUrl/api/v1/auth/login" -Method Post `
        -ContentType "application/json" -Body $loginBody -TimeoutSec 30 -ErrorAction Stop
}
catch {
    Write-GateFail "POST /api/v1/auth/login failed for $email"
}

$token = [string]$login.access_token
if (-not $token) {
    Write-GateFail "No access_token in login response"
}
Write-GateOk "Login as $email"

$headers = @{ Authorization = "Bearer $token" }
$tickets = Invoke-RestMethod -Uri "$ApiUrl/api/v1/tickets?page=1&page_size=5" -Headers $headers -Method Get -TimeoutSec 30 -ErrorAction Stop

$count = 0
if ($tickets -is [System.Array]) {
    $count = $tickets.Count
}
elseif ($tickets.items) {
    $count = @($tickets.items).Count
}
elseif ($tickets.data) {
    $count = @($tickets.data).Count
}

if ($count -lt 1) {
    Write-GateFail "Expected at least 1 ticket (got $count). Run bootstrap-dev-database.sh?"
}
Write-GateOk "Tickets listed (count=$count)"
Write-Host "GATE PASSED (API hello-world)"

if ($Full) {
    Write-Host ""
    $playwrightDir = Join-Path $RepoRoot "scripts\node_modules\playwright"
    if (-not (Test-Path -LiteralPath $playwrightDir)) {
        Write-Host "==> Installing Playwright (scripts/)"
        Push-Location (Join-Path $RepoRoot "scripts")
        try {
            & npm install --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
            & npx playwright install chromium
            if ($LASTEXITCODE -ne 0) { throw "playwright install failed" }
        }
        finally {
            Pop-Location
        }
    }

    Push-Location $RepoRoot
    try {
        & node (Join-Path $RepoRoot "scripts\hello-world-gate.mjs")
        if ($LASTEXITCODE -ne 0) {
            throw "hello-world-gate.mjs failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "=============================================="
Write-Host " DELIVERABLE GATE PASSED"
Write-Host " Attach this output (+ screenshots if -Full) to your PR/handoff."
Write-Host "=============================================="
