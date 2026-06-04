#Requires -Version 7.0
<#
.SYNOPSIS
  Staging Preview hello-world gate (alias for deliverable gate -Staging).

.EXAMPLE
  pwsh -File scripts/verify-staging-hello-world.ps1
  pwsh -File scripts/run-deliverable-gate.ps1 -Staging
#>
param(
    [string]$ApiUrl,
    [string]$Email,
    [string]$Password,
    [string]$VercelShareUrl
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib/windows-dev.ps1")
. (Join-Path $PSScriptRoot "lib/staging-hello-world-gate.ps1")

$RepoRoot = Get-StardeskRepoRoot -StartDir $PSScriptRoot

try {
    Invoke-StardeskStagingHelloWorldGate -ApiUrl $ApiUrl -Email $Email -Password $Password `
        -VercelShareUrl $VercelShareUrl -RepoRoot $RepoRoot
}
catch {
    Write-Host "GATE FAIL: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=============================================="
Write-Host " STAGING HELLO-WORLD GATE PASSED"
Write-Host "=============================================="
