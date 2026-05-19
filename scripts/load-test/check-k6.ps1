# Exit 1 if k6 is not available (for CI and local preflight).
$ErrorActionPreference = "Stop"
$k6Dir = "${env:ProgramFiles}\k6"
if (Test-Path "$k6Dir\k6.exe") {
  $env:Path = "$k6Dir;" + $env:Path
}
$k6 = Get-Command k6 -ErrorAction SilentlyContinue
if (-not $k6) {
  Write-Error @"
k6 is not installed or not on PATH.

Install on Windows (pick one):
  winget install GrafanaLabs.k6 --accept-package-agreements --accept-source-agreements
  choco install k6 -y

Then open a new terminal and run: k6 version
See docs/destructive-testing.md for details.
"@
  exit 1
}
& k6 version
exit 0
