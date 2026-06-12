#Requires -Version 7.0
<#
.SYNOPSIS
  Ensures Git Bash (bash.exe) is on the user PATH for Windows terminals and Cursor agents.

.EXAMPLE
  pwsh -File scripts/ensure-git-bash-path.ps1
#>
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib/windows-dev.ps1")

$bash = Ensure-StardeskGitBashOnPath
& $bash --version
Write-Host ""
Write-Host "bash is available. Open a new terminal if 'bash' is still not recognized."
Write-Host "  Example: bash scripts/run-deliverable-gate.sh --full"
