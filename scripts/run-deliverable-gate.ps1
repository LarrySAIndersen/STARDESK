#Requires -Version 7.0
<#
.SYNOPSIS
  Mandatory deliverable gate for Windows (PowerShell native).

.EXAMPLE
  pwsh -File scripts/run-deliverable-gate.ps1
  pwsh -File scripts/run-deliverable-gate.ps1 -Full
  pwsh -File scripts/run-deliverable-gate.ps1 -Staging
  pwsh -File scripts/run-deliverable-gate.ps1 -Full -Staging
  pwsh -File scripts/run-deliverable-gate.ps1 -SkipTests
#>
param(
    [switch]$Full,
    [switch]$Staging,
    [switch]$SkipTests,
    [switch]$SkipStaging
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib/windows-dev.ps1")
. (Join-Path $PSScriptRoot "lib/staging-hello-world-gate.ps1")

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

function Ensure-StardeskPlaywright {
    $playwrightDir = Join-Path $RepoRoot "scripts\node_modules\playwright"
    if (Test-Path -LiteralPath $playwrightDir) { return }
    Write-Host "==> Installing Playwright (scripts/)"
    Push-Location (Join-Path $RepoRoot "scripts")
    try {
        & npm install --no-audit --no-fund --ignore-scripts
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
        & npx playwright install chromium
        if ($LASTEXITCODE -ne 0) { throw "playwright install failed" }
    }
    finally {
        Pop-Location
    }
}

function Invoke-StardeskHelloWorldUiGate {
    param(
        [string]$WebUrl,
        [string]$GateLabel
    )
    if ((Test-StardeskVercelProtectedUrl -Url $WebUrl) -and -not $env:VERCEL_PROTECTION_BYPASS) {
        try {
            $env:VERCEL_PROTECTION_BYPASS = Get-StardeskVercelProtectionBypass -DeploymentUrl $WebUrl `
                -VercelProjectDir (Join-Path $RepoRoot "apps\web")
        }
        catch {
            Write-Host "Note: $($_.Exception.Message) — UI gate may need VERCEL_PROTECTION_BYPASS." -ForegroundColor Yellow
        }
    }
    $env:STARDESK_WEB_URL = $WebUrl.TrimEnd("/")
    Write-Host ""
    Write-Host "==> Hello-world gate (UI) — $GateLabel — $($env:STARDESK_WEB_URL)"
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
        & (Get-StardeskApiVenvPytest -ApiDir $ApiDir) -q --tb=line
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
    $health = Invoke-StardeskApiRequest -ApiUrl $ApiUrl -Path "/health" -Method GET
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
    $login = Invoke-StardeskApiRequest -ApiUrl $ApiUrl -Path "/api/v1/auth/login" -Method POST -BodyJson $loginBody
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
$tickets = Invoke-StardeskApiRequest -ApiUrl $ApiUrl -Path "/api/v1/tickets?page=1&page_size=5" `
    -Headers $headers -Method GET

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
Write-Host "GATE PASSED (local API hello-world)"

$runStaging = $Staging -and -not $SkipStaging

if ($Full) {
    Ensure-StardeskPlaywright
    $localWeb = if ($env:STARDESK_WEB_URL) { $env:STARDESK_WEB_URL } else { "http://localhost:3000" }
    Invoke-StardeskHelloWorldUiGate -WebUrl $localWeb -GateLabel "local"
}

if ($runStaging) {
    Write-Host ""
    try {
        Invoke-StardeskStagingHelloWorldGate -Password $env:TEST_USER_PASSWORD -RepoRoot $RepoRoot
    }
    catch {
        Write-GateFail $_.Exception.Message
    }

    if ($Full) {
        Ensure-StardeskPlaywright
        $stagingWeb = $env:STARDESK_STAGING_WEB_URL
        if (-not $stagingWeb) { $stagingWeb = $script:StardeskDefaultStagingWebUrl }
        $stagingApi = $env:STARDESK_STAGING_API_URL
        if (-not $stagingApi) { $stagingApi = $script:StardeskDefaultStagingApiUrl }
        $env:STARDESK_API_URL = $stagingApi.TrimEnd("/")
        Invoke-StardeskHelloWorldUiGate -WebUrl $stagingWeb -GateLabel "staging Preview"
    }
}

Write-Host ""
Write-Host "=============================================="
if ($runStaging) {
    Write-Host " DELIVERABLE GATE PASSED (local + staging hello-world)"
}
else {
    Write-Host " DELIVERABLE GATE PASSED (local hello-world)"
    Write-Host " Tip: after merge to staging, run with -Staging for cloud Preview check."
}
Write-Host " Attach this output (+ screenshots if -Full) to your PR/handoff."
Write-Host "=============================================="
