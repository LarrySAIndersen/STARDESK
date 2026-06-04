#Requires -Version 7.0
<#
.SYNOPSIS
  Push Neon test + staging URLs to Vercel Preview (branch: staging) and redeploy api + web.

.EXAMPLE
  pwsh -File scripts/set-staging-vercel-preview-env.ps1
  pwsh -File scripts/set-staging-vercel-preview-env.ps1 -SkipRedeploy
#>
param([switch]$SkipRedeploy)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib/windows-dev.ps1")

$RepoRoot = Get-StardeskRepoRoot -StartDir $PSScriptRoot
$ApiDir = Join-Path $RepoRoot "apps\api"
$WebDir = Join-Path $RepoRoot "apps\web"

$StagingApiUrl = "https://api-git-staging-kjaerby-1628s-projects.vercel.app"
$StagingWebUrl = "https://web-git-staging-kjaerby-1628s-projects.vercel.app"
$GitBranch = "staging"

function Read-DotEnv([string]$Path) {
    $map = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing env file: $Path"
    }
    foreach ($line in Get-Content -LiteralPath $Path) {
        $t = $line.Trim()
        if (-not $t -or $t.StartsWith("#")) { continue }
        $eq = $t.IndexOf("=")
        if ($eq -lt 1) { continue }
        $key = $t.Substring(0, $eq).Trim()
        $val = $t.Substring($eq + 1).Trim().Trim('"').Trim("'")
        $map[$key] = $val
    }
    return $map
}

function Set-VercelPreviewEnv(
    [string]$ProjectDir,
    [string]$Name,
    [string]$Value
) {
    if ([string]::IsNullOrWhiteSpace($Value)) {
        Write-Host "  skip $Name (empty)"
        return
    }
    Write-Host "  + $Name (preview/$GitBranch)"
    Push-Location $ProjectDir
    try {
        & vercel env add $Name preview $GitBranch --yes --force --value $Value 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "vercel env add failed for $Name (exit $LASTEXITCODE)"
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-StagingRedeploy([string]$ProjectDir, [string]$Label) {
    Write-Host ""
    Write-Host "==> Redeploy $Label (preview, branch $GitBranch)"
    Push-Location $ProjectDir
    try {
        & vercel deploy --yes 2>&1 | ForEach-Object { Write-Host $_ }
        if ($LASTEXITCODE -ne 0) {
            throw "vercel deploy failed for $Label"
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host "=============================================="
Write-Host " STARDESK — Vercel Preview env (staging)"
Write-Host "=============================================="

$api = Read-DotEnv (Join-Path $ApiDir ".env")
$api["FRONTEND_URL"] = $StagingWebUrl
if (-not $api["DATABASE_URL"]) {
    throw "DATABASE_URL missing in apps/api/.env — run: bash scripts/sync-neon-env.sh"
}
if ($api["DATABASE_URL"] -notmatch "asyncpg") {
    $api["DATABASE_URL"] = $api["DATABASE_URL"] -replace "^postgresql://", "postgresql+asyncpg://"
}

Write-Host ""
Write-Host "==> API project (Neon test branch)"
$apiKeys = @(
    "DATABASE_URL",
    "STARDESK_ENV",
    "APP_ENV",
    "JWT_SECRET",
    "FRONTEND_URL",
    "PROTOTYPE_BOOTSTRAP_PASSWORD",
    "CRON_SECRET",
    "WEBHOOK_SECRET",
    "SLACK_MOCK",
    "GMAIL_MOCK",
    "GMAIL_ALLOW_PLAINTEXT_TOKENS",
    "MAIL_FROM",
    "UPLOAD_DIR"
)
foreach ($key in $apiKeys) {
    Set-VercelPreviewEnv -ProjectDir $ApiDir -Name $key -Value $api[$key]
}

$webPath = Join-Path $WebDir ".env.local"
if (-not (Test-Path -LiteralPath $webPath)) {
    $webPath = Join-Path $WebDir ".env.development.example"
}
$web = Read-DotEnv $webPath
$web["NEXT_PUBLIC_API_URL"] = $StagingApiUrl
$web["NEXT_PUBLIC_STARDESK_ENV"] = "test"
$web["NEXT_PUBLIC_ENABLE_DEMO_LOGIN"] = "true"
if (-not $web["NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_PASSWORD"]) {
    $web["NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_PASSWORD"] = $api["PROTOTYPE_BOOTSTRAP_PASSWORD"]
}

Write-Host ""
Write-Host "==> Web project"
$webKeys = @(
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_STARDESK_ENV",
    "NEXT_PUBLIC_ENABLE_DEMO_LOGIN",
    "NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_PASSWORD"
)
foreach ($key in $webKeys) {
    Set-VercelPreviewEnv -ProjectDir $WebDir -Name $key -Value $web[$key]
}

if (-not $SkipRedeploy) {
    Invoke-StagingRedeploy -ProjectDir $ApiDir -Label "api"
    Invoke-StagingRedeploy -ProjectDir $WebDir -Label "web"
}

Write-Host ""
Write-Host "Done. Run: pwsh -File scripts/run-deliverable-gate.ps1 -Staging"
Write-Host "=============================================="
