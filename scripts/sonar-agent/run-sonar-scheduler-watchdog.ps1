# Sonar scheduler watchdog — keeps run-sonar-loop-scheduler.ps1 alive.
# PID: reports/sonar-scheduler-watchdog.pid
# Log: reports/sonar-scheduler-watchdog.log
#
# Usage:
#   pwsh -File scripts/sonar-agent/run-sonar-scheduler-watchdog.ps1 -Once
#   pwsh -File scripts/sonar-agent/run-sonar-scheduler-watchdog.ps1 -Background
#   pwsh -File scripts/sonar-agent/run-sonar-scheduler-watchdog.ps1 -Stop

param(
    [int]$IntervalMinutes = 5,
    [int]$SchedulerTickIntervalMinutes = 30,
    [switch]$DryRun,
    [switch]$Once,
    [switch]$Stop,
    [switch]$Background
)

$ErrorActionPreference = "Continue"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$ReportsDir = Join-Path $RepoRoot "reports"
$WatchdogPidFile = Join-Path $ReportsDir "sonar-scheduler-watchdog.pid"
$WatchdogLogFile = Join-Path $ReportsDir "sonar-scheduler-watchdog.log"
$SchedulerPidFile = Join-Path $ReportsDir "sonar-loop-scheduler.pid"
$SchedulerScript = Join-Path $PSScriptRoot "run-sonar-loop-scheduler.ps1"
$SyncScript = Join-Path $RepoRoot "scripts/sonar-agent/sync-scheduler-to-canvas.mjs"

function Write-AgentLog {
    param([string]$Message, [string]$Level = "INFO")
    if (-not (Test-Path $ReportsDir)) {
        New-Item -ItemType Directory -Path $ReportsDir -Force | Out-Null
    }
    $ts = (Get-Date).ToString("o")
    $line = "[$ts] [$Level] $Message"
    Add-Content -Path $WatchdogLogFile -Value $line -Encoding utf8
    if ($Level -eq "ERROR") { Write-Host $line -ForegroundColor Red }
    elseif ($Level -eq "WARN") { Write-Host $line -ForegroundColor Yellow }
    else { Write-Host $line }
}

function Get-ShellExe {
    if (Get-Command pwsh -ErrorAction SilentlyContinue) { return (Get-Command pwsh).Source }
    throw "PowerShell 7 (pwsh) is required for Sonar scheduler watchdog."
}

function Test-ProcessAlive {
    param([string]$PidPath)
    if (-not (Test-Path $PidPath)) { return $false }
    $pidVal = (Get-Content $PidPath -Raw).Trim()
    if ($pidVal -notmatch '^\d+$') { return $false }
    return $null -ne (Get-Process -Id ([int]$pidVal) -ErrorAction SilentlyContinue)
}

function Sync-SchedulerCanvas {
    if (-not (Test-Path $SyncScript)) { return }
    Push-Location (Join-Path $RepoRoot "scripts")
    try {
        & node "./sonar-agent/sync-scheduler-to-canvas.mjs" 2>&1 | Out-Null
    } catch {
        Write-AgentLog "canvas sync failed: $($_.Exception.Message)" "WARN"
    } finally {
        Pop-Location
    }
}

function Restart-Scheduler {
    if ($DryRun) {
        Write-AgentLog "DRY-RUN would restart sonar loop scheduler" "WARN"
        return "dry_run"
    }
    if (-not (Test-Path $SchedulerScript)) {
        throw "Scheduler script missing: $SchedulerScript"
    }
    $shell = Get-ShellExe
    & $shell -NoProfile -ExecutionPolicy Bypass -File $SchedulerScript `
        -Background -TickIntervalMinutes $SchedulerTickIntervalMinutes 2>&1 | Out-String | ForEach-Object { $_.Trim() }
    if ($LASTEXITCODE -ne 0) { throw "scheduler -Background failed (exit $LASTEXITCODE)" }
    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 1
        if (Test-ProcessAlive -PidPath $SchedulerPidFile) {
            $pidVal = (Get-Content $SchedulerPidFile -Raw).Trim()
            return "scheduler restarted pid=$pidVal"
        }
    }
    throw "scheduler PID file not created within 20s"
}

function Invoke-AgentTick {
    $alive = Test-ProcessAlive -PidPath $SchedulerPidFile
    Write-AgentLog "scheduler alive=$alive pid_file=$SchedulerPidFile"
    if (-not $alive) {
        try {
            $detail = Restart-Scheduler
            Write-AgentLog "REPAIR ok: $detail"
        } catch {
            Write-AgentLog "REPAIR failed: $($_.Exception.Message)" "ERROR"
        }
    }
    Sync-SchedulerCanvas
}

function Stop-Agent {
    if (-not (Test-Path $WatchdogPidFile)) {
        Write-Host "Sonar scheduler watchdog is not running (no PID file)."
        return
    }
    $pidVal = (Get-Content $WatchdogPidFile -Raw).Trim()
    if ($pidVal -match '^\d+$') {
        $proc = Get-Process -Id ([int]$pidVal) -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id ([int]$pidVal) -Force
            Write-AgentLog "watchdog stopped pid=$pidVal"
            Write-Host "Stopped sonar scheduler watchdog (pid=$pidVal)."
        } else {
            Write-Host "Stale watchdog PID file (process $pidVal not found)."
        }
    }
    Remove-Item $WatchdogPidFile -Force -ErrorAction SilentlyContinue
}

if ($Stop) {
    Stop-Agent
    exit 0
}

if ($Background) {
    if (Test-ProcessAlive -PidPath $WatchdogPidFile) {
        $existing = (Get-Content $WatchdogPidFile -Raw).Trim()
        Write-Host "Sonar scheduler watchdog already running (pid=$existing)."
        exit 0
    }
    $shell = Get-ShellExe
    $argLine = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -IntervalMinutes $IntervalMinutes -SchedulerTickIntervalMinutes $SchedulerTickIntervalMinutes"
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $shell
    $startInfo.Arguments = $argLine
    $startInfo.WorkingDirectory = $RepoRoot
    $startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $startInfo.UseShellExecute = $false
    [void][System.Diagnostics.Process]::Start($startInfo)
    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 1
        if (Test-ProcessAlive -PidPath $WatchdogPidFile) {
            $pidVal = (Get-Content $WatchdogPidFile -Raw).Trim()
            Write-Host "Sonar scheduler watchdog started in background (pid=$pidVal)."
            exit 0
        }
    }
    Write-Error "Watchdog did not write PID file within 20s."
    exit 1
}

if (-not $Once -and -not $DryRun) {
    if (Test-ProcessAlive -PidPath $WatchdogPidFile) {
        $existing = (Get-Content $WatchdogPidFile -Raw).Trim()
        Write-Host "Sonar scheduler watchdog already running (pid=$existing). Use -Stop to stop."
        exit 0
    }
    Set-Content -Path $WatchdogPidFile -Value $PID -Encoding ascii
    Write-AgentLog "watchdog started pid=$PID interval=${IntervalMinutes}m"
}

try {
    do {
        Invoke-AgentTick
        if ($Once) { break }
        Start-Sleep -Seconds ($IntervalMinutes * 60)
    } while ($true)
} finally {
    if (-not $Once -and -not $DryRun) {
        Remove-Item $WatchdogPidFile -Force -ErrorAction SilentlyContinue
        Write-AgentLog "watchdog exited pid=$PID"
    }
}
