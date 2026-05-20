#Requires -Version 5.1
<#
.SYNOPSIS
  Checklist and commands to stand up STARdesk TEST (and optional prod-clone) environments.

.DESCRIPTION
  Does not write secrets. Prints steps for Neon branches and Vercel Preview env vars.
  See docs/environments.md for full architecture.

.EXAMPLE
  .\scripts\setup-test-environment.ps1
  .\scripts\setup-test-environment.ps1 -ProdClone
#>
param(
    [switch]$ProdClone
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent

Write-Host ""
Write-Host "=== STARdesk environment setup ===" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot"
Write-Host "Doc:  docs/environments.md"
Write-Host ""

function Test-Command($Name) {
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

$hasVercel = Test-Command vercel
$hasNeon = Test-Command neon

if (-not $hasVercel) {
    Write-Warning "Vercel CLI not found. Install: npm i -g vercel"
} else {
    Write-Host "[OK] vercel CLI" -ForegroundColor Green
    try { vercel whoami 2>&1 | Out-Null } catch { Write-Warning "Run: vercel login" }
}

if (-not $hasNeon) {
    Write-Warning "Neon CLI not found (optional). Install: https://neon.tech/docs/reference/cli-install"
} else {
    Write-Host "[OK] neon CLI" -ForegroundColor Green
}

$neonProjectId = "jolly-paper-24762962"
$vercelTeam = "kjaerby-1628s-projects"

Write-Host ""
Write-Host "--- Step 1: Neon branch 'test' ---" -ForegroundColor Yellow
Write-Host @"
  Project ID (console): $neonProjectId
  Create branch:
    neon branches create --project-id $neonProjectId --name test --parent main
  Connection string -> postgresql+asyncpg://... for DATABASE_URL (test only)
"@

Write-Host ""
Write-Host "--- Step 2: Database schema + seed (test branch only) ---" -ForegroundColor Yellow
Write-Host @"
  cd apps\api
  `$env:DATABASE_URL = '<test connection string>'
  python ..\..\scripts\run_neon_setup.py
  # Optional: run docs/test-data.sql in Neon SQL Editor
"@

Write-Host ""
Write-Host "--- Step 3: Vercel Preview env (projects: web, api) ---" -ForegroundColor Yellow
Write-Host @"
  Team: $vercelTeam
  Templates:
    apps\api\.env.test.example
    apps\web\.env.test.example

  API (Preview scope) — set at minimum:
    DATABASE_URL, FRONTEND_URL, JWT_SECRET, APP_ENV=development

  Web (Preview scope):
    NEXT_PUBLIC_API_URL, NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true
    BASIC_AUTH_USER + BASIC_AUTH_PASSWORD (recommended)

  CLI example (from apps\api, after vercel link):
    `$env:VERCEL_ORG_ID = 'team_WAOS6DVTpQTnSqopWOIZf717'
    `$env:VERCEL_PROJECT_ID = 'prj_TG8sOhHjUBMrcSmTVEDpr1rydHP0'
    vercel env add DATABASE_URL preview

  Create git branch staging and push to trigger Preview deploy.
"@

Write-Host ""
Write-Host "--- Step 4: Wire URLs ---" -ForegroundColor Yellow
Write-Host @"
  1. Deploy API test -> copy https://...vercel.app
  2. Set web NEXT_PUBLIC_API_URL to that URL -> redeploy web
  3. Set API FRONTEND_URL to web test URL -> redeploy API
  4. curl https://<api-test>/health
"@

if ($ProdClone) {
    Write-Host ""
    Write-Host "--- Optional: Prod-clone (UAT) ---" -ForegroundColor Yellow
    Write-Host @"
  Neon:
    neon branches create --project-id $neonProjectId --name prod-clone --parent main

  Vercel: duplicate projects as web-prodclone + api-prodclone (root apps/web, apps/api)
  Copy Production env vars from web/api, then override ONLY:
    DATABASE_URL -> prod-clone branch
    FRONTEND_URL / NEXT_PUBLIC_API_URL -> prodclone URLs

  Templates: apps\api\.env.prodclone.example, apps\web\.env.prodclone.example
  Enable BASIC_AUTH on web-prodclone (may contain prod data copy).
"@
}

Write-Host ""
Write-Host "--- Current production reference URLs ---" -ForegroundColor DarkGray
Write-Host "  Web: https://web-seven-neon-6bvmcoel7n.vercel.app"
Write-Host "  API: https://api-gamma-amber.vercel.app"
Write-Host ""
Write-Host "Done. Fill URL table in docs/environments.md after deploy." -ForegroundColor Green
Write-Host ""
