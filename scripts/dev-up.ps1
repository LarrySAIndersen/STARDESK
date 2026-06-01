#Requires -Version 7.0
<#
.SYNOPSIS
  Start API (:8000) and Web (:3000) dev servers on Windows.

.EXAMPLE
  pwsh -File scripts/dev-up.ps1
#>
param(
    [switch]$Stop,
    [switch]$ForcePorts
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib/windows-dev.ps1")

$RepoRoot = Get-StardeskRepoRoot -StartDir $PSScriptRoot
$ApiDir = Join-Path $RepoRoot "apps\api"
$WebDir = Join-Path $RepoRoot "apps\web"
$PidFile = Join-Path $RepoRoot "reports\dev-up.pids.json"

function Get-PortListenerPids {
    param([int]$Port)

    $pids = @()
    $matches = netstat -ano | Select-String "LISTENING" | Select-String ":$Port\s"
    foreach ($line in $matches) {
        $listenerPid = [int](($line -split "\s+")[-1])
        if ($listenerPid -gt 0) {
            $pids += $listenerPid
        }
    }
    return @($pids | Select-Object -Unique)
}

function Stop-StardeskDevServers {
    if (-not (Test-Path -LiteralPath $PidFile)) {
        Write-Host "No dev server PID file ($PidFile)."
        return
    }
    $pids = Get-Content -LiteralPath $PidFile | ConvertFrom-Json
    foreach ($entry in @($pids)) {
        $proc = Get-Process -Id $entry.pid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "Stopping $($entry.name) (PID $($entry.pid))..."
            Stop-Process -Id $entry.pid -Force -ErrorAction SilentlyContinue
        }
    }
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

if ($Stop) {
    Stop-StardeskDevServers
    exit 0
}

Stop-StardeskDevServers

$portsInUse = @(8000, 3000 | ForEach-Object { Get-PortListenerPids -Port $_ } | Select-Object -Unique)
if ($portsInUse.Count -gt 0) {
    $names = ($portsInUse | ForEach-Object {
        $proc = Get-Process -Id $_ -ErrorAction SilentlyContinue
        if ($proc) { "$($proc.ProcessName) ($_)" } else { "PID $_" }
    }) -join ", "
    if ($ForcePorts) {
        Write-Host "Stopping listeners on :8000 / :3000 ($names)..." -ForegroundColor Yellow
        foreach ($listenerPid in $portsInUse) {
            Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2
    }
    else {
        Write-Warning "Ports 8000/3000 already in use ($names). Often WSL (wslrelay). Use -ForcePorts or stop other dev servers first."
    }
}

Repair-StardeskApiVenv -ApiDir $ApiDir
Import-StardeskDotEnv -Path (Join-Path $ApiDir ".env")

if (-not (Test-Path (Join-Path $WebDir "node_modules\.bin\next.cmd"))) {
    Write-Host "Installing web dependencies (missing next CLI)..."
    Push-Location $WebDir
    try {
        & npm ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
    }
    finally {
        Pop-Location
    }
}

$apiProc = Start-Process -FilePath "uv" -PassThru -WindowStyle Hidden -WorkingDirectory $ApiDir -ArgumentList @(
    "run", "uvicorn", "star_itsm_api.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"
) -RedirectStandardOutput (Join-Path $RepoRoot "reports\dev-up-api.log") -RedirectStandardError (Join-Path $RepoRoot "reports\dev-up-api.err.log")

Write-Host "Starting API on http://localhost:8000 ..."
$webLog = Join-Path $RepoRoot "reports\dev-up-web.log"
$webErrLog = Join-Path $RepoRoot "reports\dev-up-web.err.log"
$webProc = Start-Process -FilePath "npm.cmd" -PassThru -WindowStyle Hidden -WorkingDirectory $WebDir -ArgumentList @(
    "run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3000"
) -RedirectStandardOutput $webLog -RedirectStandardError $webErrLog

Write-Host "Starting Web on http://localhost:3000 ..."

@(
    @{ name = "api"; pid = $apiProc.Id },
    @{ name = "web"; pid = $webProc.Id }
) | ConvertTo-Json | Set-Content -LiteralPath $PidFile -Encoding utf8

Write-Host "Waiting for API..."
$apiReady = $false
for ($i = 0; $i -lt 45; $i++) {
    try {
        $null = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 2
        $apiReady = $true
        break
    }
    catch {
        Start-Sleep -Seconds 1
    }
}

$webReady = $false
if ($apiReady) {
    Write-Host "Waiting for Web..."
    for ($i = 0; $i -lt 90; $i++) {
        try {
            $null = Invoke-WebRequest -Uri "http://127.0.0.1:3000/" -UseBasicParsing -TimeoutSec 3
            $webReady = $true
            break
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }
}

if ($apiReady) {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health"
    Write-Host "API health: stardesk_env=$($health.stardesk_env) app_env=$($health.app_env) deployment=$($health.deployment)"
    if ($webReady) {
        Write-Host "Web:  http://127.0.0.1:3000"
    }
    else {
        Write-Warning "Web not ready — see reports/dev-up-web.err.log (API gate still works)."
    }
    Write-Host "Stop: pwsh -File scripts/dev-up.ps1 -Stop"
}
else {
    Write-Warning "API did not become ready within 45s. Logs: reports/dev-up-api.err.log"
}
