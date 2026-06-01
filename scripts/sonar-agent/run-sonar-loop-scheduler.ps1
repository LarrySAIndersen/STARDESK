# Background scheduler: invokes run-sonar-loop-tick.ps1 every 30 minutes.
# PID file: reports/sonar-loop-scheduler.pid
# Log: reports/sonar-loop-scheduler.log
# Last tick: reports/sonar-loop-last-tick.json

param(
    [int]$TickIntervalMinutes = 30,
    [switch]$Stop
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

function Write-LastTick {
    param([string]$Status)
    $payload = @{
        at     = (Get-Date).ToUniversalTime().ToString("o")
        pid    = $PID
        status = $Status
    } | ConvertTo-Json -Compress
    Set-Content -Path $LastTickFile -Value $payload -Encoding utf8NoBOM
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
Sync-SchedulerToCanvas

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
