# Check Apache JMeter installation (Windows)
$ErrorActionPreference = "Stop"

$jmeter = Get-Command jmeter -ErrorAction SilentlyContinue
if (-not $jmeter) {
    $jmeterBat = Get-Command jmeter.bat -ErrorAction SilentlyContinue
    if ($jmeterBat) {
        Write-Host "OK: jmeter.bat found at $($jmeterBat.Source)"
        & jmeter.bat -v
        exit 0
    }
    Write-Host "JMeter not found on PATH."
    Write-Host "Install options:"
    Write-Host "  choco install jmeter"
    Write-Host "  winget install Apache.JMeter"
    Write-Host "  Manual: https://jmeter.apache.org/download_jmeter.cgi"
    exit 1
}

Write-Host "OK: jmeter found at $($jmeter.Source)"
& jmeter -v
