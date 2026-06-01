# STARDESK watchdog — monitors Sonar loop, git drift, and CI; auto-repairs when safe.
# Log: reports/watchdog-latest.log + reports/watchdog-latest.json
# PID: reports/watchdog.pid
#
# Usage (requires PowerShell 7+ / pwsh):
#   pwsh -File scripts/stardesk-watchdog.ps1              # run loop (15 min default)
#   pwsh -File scripts/stardesk-watchdog.ps1 -Once        # single check
#   pwsh -File scripts/stardesk-watchdog.ps1 -DryRun      # log actions only
#   pwsh -File scripts/stardesk-watchdog.ps1 -Stop        # stop background watchdog

param(
    [int]$IntervalMinutes = 15,
    [int]$SonarTickIntervalMinutes = 30,
    [int]$SonarScanMaxAgeHours = 2,
    [switch]$DryRun,
    [switch]$Once,
    [switch]$Stop
)

$ErrorActionPreference = "Continue"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ReportsDir = Join-Path $RepoRoot "reports"
$WatchdogPidFile = Join-Path $ReportsDir "watchdog.pid"
$WatchdogLogFile = Join-Path $ReportsDir "watchdog-latest.log"
$WatchdogJsonFile = Join-Path $ReportsDir "watchdog-latest.json"
$SchedulerPidFile = Join-Path $ReportsDir "sonar-loop-scheduler.pid"
$SchedulerScript = Join-Path $RepoRoot "scripts/sonar-agent/run-sonar-loop-scheduler.ps1"
$TickScript = Join-Path $RepoRoot "scripts/sonar-agent/run-sonar-loop-tick.ps1"
$LastTickFile = Join-Path $ReportsDir "sonar-loop-last-tick.json"
$SonarReportFile = Join-Path $ReportsDir "sonar-agent-latest.json"
$SonarEnvFile = Join-Path $RepoRoot "scripts/sonar-agent/.env"
$SonarLoopBranch = "cursor/sonar-remediation-loop"

function Write-WatchdogLog {
    param([string]$Message, [string]$Level = "INFO")
    $ts = (Get-Date).ToString("o")
    $line = "[$ts] [$Level] $Message"
    Add-Content -Path $WatchdogLogFile -Value $line -Encoding utf8
    if ($Level -eq "ERROR") { Write-Host $line -ForegroundColor Red }
    elseif ($Level -eq "WARN") { Write-Host $line -ForegroundColor Yellow }
    else { Write-Host $line }
}

function Sync-SchedulerToCanvas {
    $syncScript = Join-Path $RepoRoot "scripts/sonar-agent/sync-scheduler-to-canvas.mjs"
    if (-not (Test-Path $syncScript)) { return }
    Push-Location (Join-Path $RepoRoot "scripts")
    try {
        & node "./sonar-agent/sync-scheduler-to-canvas.mjs" 2>&1 | Out-Null
    } catch {
        Write-WatchdogLog "canvas scheduler sync failed: $($_.Exception.Message)" "WARN"
    } finally {
        Pop-Location
    }
}

function Write-WatchdogStatus {
    param([hashtable]$RunResult)
    $entry = @{
        at      = (Get-Date).ToUniversalTime().ToString("o")
        dry_run = [bool]$DryRun
        checks  = $RunResult
    }
    $history = @()
    if (Test-Path $WatchdogJsonFile) {
        try {
            $raw = Get-Content $WatchdogJsonFile -Raw -Encoding utf8
            $parsed = $raw | ConvertFrom-Json
            if ($parsed.history) { $history = @($parsed.history) }
            elseif ($parsed -is [System.Array]) { $history = @($parsed) }
            else { $history = @($parsed) }
        } catch { $history = @() }
    }
    $history = @($history) + @($entry)
    if ($history.Count -gt 100) { $history = $history[-100..-1] }
    $payload = @{
        updated_at = (Get-Date).ToUniversalTime().ToString("o")
        history    = $history
    } | ConvertTo-Json -Depth 8
    Set-Content -Path $WatchdogJsonFile -Value $payload -Encoding utf8NoBOM
    Sync-SchedulerToCanvas
}

function Invoke-RepoGit {
    param([string[]]$Args)
    Push-Location $RepoRoot
    try {
        $out = & git @Args 2>&1 | Out-String
        return @{ ok = ($LASTEXITCODE -eq 0); output = $out.Trim(); code = $LASTEXITCODE }
    } finally { Pop-Location }
}

function Test-ProcessAlive {
    param([string]$PidPath)
    if (-not (Test-Path $PidPath)) { return $false }
    $pidVal = (Get-Content $PidPath -Raw).Trim()
    if ($pidVal -notmatch '^\d+$') { return $false }
    return $null -ne (Get-Process -Id ([int]$pidVal) -ErrorAction SilentlyContinue)
}

function Invoke-RepairAction {
    param([string]$Name, [scriptblock]$Action)
    if ($DryRun) {
        Write-WatchdogLog "DRY-RUN would run: $Name" "WARN"
        return @{ action = $Name; status = "dry_run"; detail = "skipped" }
    }
    try {
        $detail = & $Action
        Write-WatchdogLog "REPAIR ok: $Name - $detail"
        return @{ action = $Name; status = "repaired"; detail = "$detail" }
    } catch {
        Write-WatchdogLog "REPAIR failed: $Name - $($_.Exception.Message)" "ERROR"
        return @{ action = $Name; status = "failed"; detail = $_.Exception.Message }
    }
}

function Test-GhAvailable {
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { return $false }
    & gh auth status 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Get-LastTickAgeMinutes {
    if (-not (Test-Path $LastTickFile)) { return $null }
    try {
        $tick = Get-Content $LastTickFile -Raw | ConvertFrom-Json
        $at = [datetime]::Parse($tick.at)
        return ((Get-Date).ToUniversalTime() - $at.ToUniversalTime()).TotalMinutes
    } catch { return $null }
}

function Get-SonarScanAgeHours {
    if (-not (Test-Path $SonarReportFile)) { return $null }
    try {
        $report = Get-Content $SonarReportFile -Raw | ConvertFrom-Json
        $at = [datetime]::Parse($report.generated_at)
        return ((Get-Date).ToUniversalTime() - $at.ToUniversalTime()).TotalHours
    } catch {
        $mtime = (Get-Item $SonarReportFile).LastWriteTime
        return ((Get-Date) - $mtime).TotalHours
    }
}

function Get-Flow2PrBody {
    param([int]$CommitsAhead)
    $logResult = Invoke-RepoGit -Args @("log", "--oneline", "origin/main..origin/staging")
    $commitLines = if ($logResult.ok -and $logResult.output) { $logResult.output } else { "(could not list commits)" }
    return @"
## Summary
Auto-created by STARDESK watchdog: ``staging`` is $CommitsAhead commit(s) ahead of ``main`` (production not updated).

## Commits pending prod
$commitLines

## Test plan
- [ ] CI green on this PR
- [ ] Vercel Production (api + web) after merge
"@
}

function Test-PrChecksGreen {
    param([int]$PrNumber)
    $checks = & gh pr checks $PrNumber --json name,state,bucket 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { return $false }
    try {
        $rows = $checks | ConvertFrom-Json
        if ($rows.Count -eq 0) { return $false }
        foreach ($row in $rows) {
            if ($row.bucket -eq "fail" -or $row.state -eq "FAILURE") { return $false }
            if ($row.state -eq "PENDING" -or $row.bucket -eq "pending") { return $false }
        }
        return $true
    } catch { return $false }
}

function Get-ShellExe {
    if (Get-Command pwsh -ErrorAction SilentlyContinue) { return "pwsh" }
    return "powershell"
}

function Invoke-WatchdogTick {
    $results = @{}

    # (a) Sonar loop scheduler running?
    $schedulerAlive = Test-ProcessAlive -PidPath $SchedulerPidFile
    $results["sonar_scheduler"] = @{
        status   = if ($schedulerAlive) { "ok" } else { "stalled" }
        pid_file = $SchedulerPidFile
    }
    if (-not $schedulerAlive) {
        $shell = Get-ShellExe
        $results["sonar_scheduler"].repair = Invoke-RepairAction -Name "restart_sonar_scheduler" -Action {
            if (-not (Test-Path $SchedulerScript)) { throw "Scheduler script missing" }
            Start-Process $shell -ArgumentList @(
                "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $SchedulerScript
            ) -WorkingDirectory $RepoRoot -WindowStyle Hidden
            $deadline = (Get-Date).AddSeconds(10)
            while ((Get-Date) -lt $deadline) {
                Start-Sleep -Seconds 1
                if (Test-ProcessAlive -PidPath $SchedulerPidFile) { return "scheduler restarted" }
            }
            throw "scheduler did not write PID file within 10s"
        }
    }

    # (d) Stale tick
    $tickAge = Get-LastTickAgeMinutes
    $staleThreshold = $SonarTickIntervalMinutes * 2
    $results["sonar_tick_freshness"] = @{
        status            = if ($null -eq $tickAge) { "unknown" } elseif ($tickAge -gt $staleThreshold) { "stale" } else { "ok" }
        age_minutes       = $tickAge
        threshold_minutes = $staleThreshold
    }
    if ($null -ne $tickAge -and $tickAge -gt $staleThreshold) {
        $shell = Get-ShellExe
        $results["sonar_tick_freshness"].repair = Invoke-RepairAction -Name "trigger_sonar_tick" -Action {
            if (-not (Test-Path $TickScript)) { throw "Tick script missing" }
            $out = & $shell -NoProfile -ExecutionPolicy Bypass -File $TickScript 2>&1 | Out-String
            $payload = @{
                at = (Get-Date).ToUniversalTime().ToString("o"); pid = $PID; status = "watchdog_trigger"
            } | ConvertTo-Json -Compress
            Set-Content -Path $LastTickFile -Value $payload -Encoding utf8NoBOM
            return $out.Trim()
        }
    }

    # (b) origin/staging drift vs origin/main
    $stagingBehindMain = 0
    $stagingAheadOfMain = 0
    $fetch = Invoke-RepoGit -Args @("fetch", "origin", "main", "staging")
    $results["git_fetch"] = @{ status = if ($fetch.ok) { "ok" } else { "failed" }; detail = $fetch.output }
    if ($fetch.ok) {
        $behindCount = Invoke-RepoGit -Args @("rev-list", "--count", "origin/staging..origin/main")
        if ($behindCount.ok -and $behindCount.output -match '^\d+$') { $stagingBehindMain = [int]$behindCount.output }
        $aheadCount = Invoke-RepoGit -Args @("rev-list", "--count", "origin/main..origin/staging")
        if ($aheadCount.ok -and $aheadCount.output -match '^\d+$') { $stagingAheadOfMain = [int]$aheadCount.output }
        $results["staging_sync"] = @{
            status         = if ($stagingBehindMain -gt 0) { "behind_main" } else { "ok" }
            commits_behind = $stagingBehindMain
        }
        $results["staging_ahead"] = @{
            status        = if ($stagingAheadOfMain -gt 0) { "ahead_of_main" } else { "ok" }
            commits_ahead = $stagingAheadOfMain
        }
        if ($stagingBehindMain -gt 0) {
            Write-WatchdogLog "ESCALATE: origin/staging is $stagingBehindMain commit(s) behind origin/main — manual PR sync required (PR-only)" "WARN"
            $results["staging_sync"].escalate = "staging behind main by $stagingBehindMain commits — Jan or PR sync"
        }
        if ($stagingAheadOfMain -gt 0) {
            Write-WatchdogLog "staging is $stagingAheadOfMain commit(s) ahead of main — Flow-2 release PR required" "WARN"
        }
    }

    # Sonar loop PR to staging (green CI, unmerged)
    $results["sonar_loop_pr"] = @{ status = "skipped" }
    if (Test-GhAvailable) {
        Push-Location $RepoRoot
        try {
            $json = & gh pr list --head $SonarLoopBranch --base staging --state open --json number,title,isDraft 2>&1 | Out-String
            if ($LASTEXITCODE -eq 0) {
                $prs = @($json | ConvertFrom-Json)
                if ($prs.Count -gt 0) {
                    foreach ($pr in $prs) {
                        if ($pr.isDraft) {
                            $results["sonar_loop_pr"] = @{ status = "draft"; number = $pr.number }
                            continue
                        }
                        $green = Test-PrChecksGreen -PrNumber $pr.number
                        $results["sonar_loop_pr"] = @{
                            status = if ($green) { "ready_to_merge" } else { "ci_pending" }; number = $pr.number
                        }
                        if ($green) {
                            $results["sonar_loop_pr"].repair = Invoke-RepairAction -Name "merge_sonar_loop_pr" -Action {
                                $mergeOut = & gh pr merge $pr.number --squash --delete-branch=false 2>&1 | Out-String
                                if ($LASTEXITCODE -ne 0) { throw $mergeOut.Trim() }
                                return "merged PR #$($pr.number) to staging"
                            }
                        }
                    }
                } else {
                    $results["sonar_loop_pr"] = @{ status = "ok"; detail = "no open sonar loop PR" }
                }
            }
        } finally { Pop-Location }
    }

    # (c) Open PR staging->main with green CI
    $results["flow2_pr"] = @{ status = "skipped"; detail = "gh not available" }
    if (Test-GhAvailable) {
        Push-Location $RepoRoot
        try {
            $prList = & gh pr list --base main --state open --json number,title,headRefName,isDraft 2>&1 | Out-String
            if ($LASTEXITCODE -eq 0) {
                $prs = @($prList | ConvertFrom-Json)
                $flow2 = @($prs | Where-Object { $_.headRefName -eq "staging" -or $_.headRefName -like "cursor/sonar*" })
                if ($flow2.Count -eq 0) {
                    if ($stagingAheadOfMain -gt 0 -and $stagingBehindMain -eq 0) {
                        $results["flow2_pr"] = @{
                            status        = "missing"
                            detail        = "staging $stagingAheadOfMain commit(s) ahead of main with no open staging->main PR"
                            commits_ahead = $stagingAheadOfMain
                        }
                        $aheadForBody = $stagingAheadOfMain
                        $results["flow2_pr"].repair = Invoke-RepairAction -Name "create_flow2_pr" -Action {
                            $body = Get-Flow2PrBody -CommitsAhead $aheadForBody
                            $createOut = & gh pr create --base main --head staging --title "Release: staging → main (watchdog)" --body $body 2>&1 | Out-String
                            if ($LASTEXITCODE -ne 0) { throw $createOut.Trim() }
                            return $createOut.Trim()
                        }
                    } else {
                        $results["flow2_pr"] = @{
                            status        = "ok"
                            detail        = "no open staging->main PR"
                            commits_ahead = $stagingAheadOfMain
                        }
                    }
                } else {
                    foreach ($pr in $flow2) {
                        if ($pr.isDraft) {
                            $results["flow2_pr"] = @{ status = "draft"; number = $pr.number; title = $pr.title }
                            $results["flow2_pr"].repair = Invoke-RepairAction -Name "ready_flow2_pr" -Action {
                                $readyOut = & gh pr ready $pr.number 2>&1 | Out-String
                                if ($LASTEXITCODE -ne 0) { throw $readyOut.Trim() }
                                return "marked PR #$($pr.number) ready for review"
                            }
                            continue
                        }
                        $green = Test-PrChecksGreen -PrNumber $pr.number
                        $results["flow2_pr"] = @{
                            status = if ($green) { "ready_to_merge" } else { "ci_pending" }
                            number = $pr.number; title = $pr.title
                        }
                        if ($green) {
                            $results["flow2_pr"].repair = Invoke-RepairAction -Name "merge_flow2_pr" -Action {
                                $mergeOut = & gh pr merge $pr.number --squash --delete-branch=false 2>&1 | Out-String
                                if ($LASTEXITCODE -ne 0) { throw $mergeOut.Trim() }
                                return "merged PR #$($pr.number): $($pr.title)"
                            }
                        }
                    }
                }
            } else {
                $results["flow2_pr"] = @{ status = "failed"; detail = $prList.Trim() }
            }
        } finally { Pop-Location }
    }

    # (e) Sonar scan stale
    $scanAge = Get-SonarScanAgeHours
    $sonarEnvExists = Test-Path $SonarEnvFile
    $results["sonar_scan"] = @{
        status        = if (-not $sonarEnvExists) { "skipped_no_env" }
                        elseif ($null -eq $scanAge) { "missing_report" }
                        elseif ($scanAge -gt $SonarScanMaxAgeHours) { "stale" }
                        else { "ok" }
        age_hours     = $scanAge
        max_age_hours = $SonarScanMaxAgeHours
        env_exists    = $sonarEnvExists
    }
    if ($sonarEnvExists -and ($null -eq $scanAge -or $scanAge -gt $SonarScanMaxAgeHours)) {
        $results["sonar_scan"].repair = Invoke-RepairAction -Name "run_sonar_pipeline" -Action {
            Push-Location (Join-Path $RepoRoot "scripts")
            try {
                $out = & npm run sonar:pipeline 2>&1 | Out-String
                if ($LASTEXITCODE -ne 0) {
                    $safe = $out -replace '(?m)(SONAR_TOKEN|token|password|secret)[=:]\s*\S+', '$1=[REDACTED]'
                    throw $safe.Trim()
                }
                return "sonar:pipeline completed"
            } finally { Pop-Location }
        }
    }

    Write-WatchdogStatus -RunResult $results
    return $results
}

function Stop-Watchdog {
    if (-not (Test-Path $WatchdogPidFile)) {
        Write-Host "Watchdog is not running (no PID file)."
        return
    }
    $pidVal = (Get-Content $WatchdogPidFile -Raw).Trim()
    if ($pidVal -match '^\d+$') {
        $proc = Get-Process -Id ([int]$pidVal) -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id ([int]$pidVal) -Force
            Write-WatchdogLog "watchdog stopped pid=$pidVal"
            Write-Host "Stopped STARDESK watchdog (pid=$pidVal)."
        } else {
            Write-Host "Stale watchdog PID file (process $pidVal not found)."
        }
    }
    Remove-Item $WatchdogPidFile -Force -ErrorAction SilentlyContinue
}

if ($Stop) { Stop-Watchdog; exit 0 }

if (-not (Test-Path $ReportsDir)) { New-Item -ItemType Directory -Path $ReportsDir -Force | Out-Null }

if (-not $Once -and -not $DryRun) {
    if (Test-ProcessAlive -PidPath $WatchdogPidFile) {
        $existing = (Get-Content $WatchdogPidFile -Raw).Trim()
        Write-Host "STARDESK watchdog already running (pid=$existing). Use -Stop to stop."
        exit 0
    }
    Set-Content -Path $WatchdogPidFile -Value $PID -Encoding ascii
    Write-WatchdogLog "watchdog started pid=$PID interval=${IntervalMinutes}m"
}

try {
    do {
        Write-WatchdogLog "tick begin"
        Invoke-WatchdogTick | Out-Null
        Write-WatchdogLog "tick end"
        if ($Once) { break }
        Start-Sleep -Seconds ($IntervalMinutes * 60)
    } while ($true)
} finally {
    if (-not $Once -and -not $DryRun) {
        Remove-Item $WatchdogPidFile -Force -ErrorAction SilentlyContinue
        Write-WatchdogLog "watchdog exited pid=$PID"
    }
}
