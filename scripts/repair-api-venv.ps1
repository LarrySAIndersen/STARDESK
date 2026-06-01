#Requires -Version 7.0
<#
.SYNOPSIS
  Recreate apps/api/.venv when it was built on Linux/WSL and breaks uv on Windows.

.EXAMPLE
  pwsh -File scripts/repair-api-venv.ps1
  pwsh -File scripts/repair-api-venv.ps1 -Force
#>
param([switch]$Force)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib/windows-dev.ps1")

$RepoRoot = Get-StardeskRepoRoot -StartDir $PSScriptRoot
$ApiDir = Join-Path $RepoRoot "apps\api"

Repair-StardeskApiVenv -ApiDir $ApiDir -Force:$Force
