# Background scheduler: invokes run-sonar-loop-tick.ps1 every 30 minutes.
# PID file: reports/sonar-loop-scheduler.pid
# Log: reports/sonar-loop-scheduler.log
# Last tick: reports/sonar-loop-last-tick.json

param(
    [int]$TickIntervalMinutes = 30,
    [switch]$Stop,
    [switch]$Background
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$ReportsDir = Join-Path $RepoRoot "reports"
$PidFile = Join-Path $ReportsDir "sonar-loop-scheduler.pid"
$LogFile = Join-Path $ReportsDir "sonar-loop-scheduler.log"
$LastTickFile = Join-Path $ReportsDir "sonar-loop-last-tick.json"
$TickScript = Join-Path $PSScriptRoot "run-sonar-loop-tick.ps1"

function Write-SchedulerLog {
    param([string]$Message)
    $ts = (Get-Date).ToString("o")
    $line = "[$ts] $Message"
    Add-Content -Path $LogFile -Value $line -Encoding utf8
}

function Stop-Scheduler {
    if (-not (Test-Path $PidFile)) {
        Write-Host "Sonar loop scheduler is not running (no PID file)."
        return
    }
    $pidVal = Get-Content $PidFile -Raw
    $pidVal = $pidVal.Trim()
    if ($pidVal -match '^\d+$') {
        $proc = Get-Process -Id ([int]$pidVal) -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id ([int]$pidVal) -Force
            Write-SchedulerLog "scheduler stopped pid=$pidVal"
            Write-Host "Stopped sonar loop scheduler (pid=$pidVal)."
        } else {
            Write-Host "Stale PID file (process $pidVal not found)."
        }
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

function Write-Utf8File {
    param([string]$Path, [string]$Content)
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

function Write-LastTick {
    param([string]$Status)
    $payload = @{
        at     = (Get-Date).ToUniversalTime().ToString("o")
        pid    = $PID
        status = $Status
    } | ConvertTo-Json -Compress
    Write-Utf8File -Path $LastTickFile -Content $payload
    Sync-SchedulerToCanvas
}

function Sync-SchedulerToCanvas {
    $syncScript = Join-Path $RepoRoot "scripts/sonar-agent/sync-scheduler-to-canvas.mjs"
    if (-not (Test-Path $syncScript)) { return }
    Push-Location (Join-Path $RepoRoot "scripts")
    try {
        & node "./sonar-agent/sync-scheduler-to-canvas.mjs" 2>&1 | Out-Null
    } catch {
        Write-SchedulerLog "canvas sync failed: $($_.Exception.Message)"
    } finally {
        Pop-Location
    }
}

if ($Stop) {
    Stop-Scheduler
    exit 0
}

function Get-ShellExe {
    if (Get-Command pwsh -ErrorAction SilentlyContinue) { return (Get-Command pwsh).Source }
    throw "PowerShell 7 (pwsh) is required for Sonar scheduler. Install from https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows"
}

function Test-SchedulerAlive {
    if (-not (Test-Path $PidFile)) { return $false }
    $pidVal = (Get-Content $PidFile -Raw).Trim()
    if ($pidVal -notmatch '^\d+$') { return $false }
    return $null -ne (Get-Process -Id ([int]$pidVal) -ErrorAction SilentlyContinue)
}

if ($Background) {
    if (-not (Test-Path $ReportsDir)) {
        New-Item -ItemType Directory -Path $ReportsDir -Force | Out-Null
    }
    if (Test-SchedulerAlive) {
        $existing = (Get-Content $PidFile -Raw).Trim()
        Write-Host "Sonar loop scheduler already running (pid=$existing)."
        exit 0
    }
    if (Test-Path $PidFile) { Remove-Item $PidFile -Force -ErrorAction SilentlyContinue }
    $shell = Get-ShellExe
    $argLine = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -TickIntervalMinutes $TickIntervalMinutes"
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $shell
    $startInfo.Arguments = $argLine
    $startInfo.WorkingDirectory = $RepoRoot
    $startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $startInfo.UseShellExecute = $false
    [void][System.Diagnostics.Process]::Start($startInfo)
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 1
        if (Test-SchedulerAlive) {
            $pidVal = (Get-Content $PidFile -Raw).Trim()
            Write-Host "Sonar loop scheduler started in background (pid=$pidVal)."
            exit 0
        }
    }
    Write-Error "Scheduler did not write PID file within 30s."
    exit 1
}

if (-not (Test-Path $ReportsDir)) {
    New-Item -ItemType Directory -Path $ReportsDir -Force | Out-Null
}

if (Test-Path $PidFile) {
    $existing = (Get-Content $PidFile -Raw).Trim()
    if ($existing -match '^\d+$') {
        $proc = Get-Process -Id ([int]$existing) -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "Sonar loop scheduler already running (pid=$existing)."
            exit 0
        }
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

Write-SchedulerLog "scheduler started pid=$PID"
Set-Content -Path $PidFile -Value $PID -Encoding ascii
try {
    Sync-SchedulerToCanvas
} catch {
    Write-SchedulerLog "canvas sync failed: $($_.Exception.Message)"
}

try {
    while ($true) {
        try {
            $output = & $TickScript 2>&1 | Out-String
            Write-SchedulerLog "tick emitted: $($output.Trim())"
            Write-LastTick -Status "ok"
        } catch {
            Write-SchedulerLog "tick error: $($_.Exception.Message)"
            Write-LastTick -Status "error"
        }
        Start-Sleep -Seconds ($TickIntervalMinutes * 60)
    }
} finally {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    Write-SchedulerLog "scheduler exited pid=$PID"
}
