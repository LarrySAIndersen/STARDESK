# Shared staging Preview hello-world gate (API: health, login, tickets).

$script:StardeskDefaultStagingApiUrl = "https://api-git-staging-kjaerby-1628s-projects.vercel.app"
$script:StardeskDefaultStagingWebUrl = "https://web-git-staging-kjaerby-1628s-projects.vercel.app"
$script:StardeskStagingGateDoc = "docs/staging-vercel-preview-env.md"

function Invoke-StardeskStagingHelloWorldGate {
    param(
        [string]$ApiUrl,
        [string]$Email,
        [string]$Password,
        [string]$VercelShareUrl,
        [string]$RepoRoot
    )

    if (-not $ApiUrl) {
        $ApiUrl = $env:STARDESK_STAGING_API_URL
    }
    if (-not $ApiUrl) {
        $ApiUrl = $script:StardeskDefaultStagingApiUrl
    }
    $ApiUrl = $ApiUrl.TrimEnd("/")

    if (-not $Email) {
        $Email = if ($env:TEST_USER_EMAIL) { $env:TEST_USER_EMAIL } else { "sf01@example.dk" }
    }

    if (-not $Password) {
        if ($RepoRoot) {
            $Password = Get-StardeskPrototypeDemoPassword -RepoRoot $RepoRoot
        }
        elseif ($env:TEST_USER_PASSWORD) {
            $Password = $env:TEST_USER_PASSWORD
        }
        else {
            throw "Password required for staging gate (set TEST_USER_PASSWORD or pass -RepoRoot)."
        }
    }

    if (-not $VercelShareUrl) {
        $VercelShareUrl = $env:VERCEL_SHARE_URL
    }

    $session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
    if ($VercelShareUrl) {
        try {
            Invoke-WebRequest -Uri $VercelShareUrl -WebSession $session -UseBasicParsing | Out-Null
        }
        catch {
            Write-Host "Note: Vercel share URL returned $($_.Exception.Message); using vercel curl fallback if needed." -ForegroundColor Yellow
        }
    }

    if ((Test-StardeskVercelProtectedUrl -Url $ApiUrl) -and -not $env:VERCEL_PROTECTION_BYPASS) {
        $webTarget = $env:STARDESK_STAGING_WEB_URL
        if (-not $webTarget) { $webTarget = $script:StardeskDefaultStagingWebUrl }
        $webTarget = $webTarget.TrimEnd("/")
        if (Test-StardeskVercelProtectedUrl -Url $webTarget) {
            try {
                $webDir = if ($RepoRoot) { Join-Path $RepoRoot "apps\web" } else { $null }
                $env:VERCEL_PROTECTION_BYPASS = Get-StardeskVercelProtectionBypass -DeploymentUrl $webTarget `
                    -VercelProjectDir $webDir
            }
            catch {
                Write-Host "Note: $($_.Exception.Message) — trying vercel curl per request." -ForegroundColor Yellow
            }
        }
    }

    Write-Host "=============================================="
    Write-Host " STARDESK hello-world gate (staging Preview)"
    Write-Host " API: $ApiUrl"
    Write-Host "=============================================="

    Write-Host ""
    Write-Host "==> Health"
    try {
        $health = Invoke-StardeskApiRequest -ApiUrl $ApiUrl -Path "/health" -Method GET -WebSession $session
    }
    catch {
        throw "GET /health failed. Is staging deployed with DATABASE_URL? See $($script:StardeskStagingGateDoc)"
    }

    $stardeskEnv = [string]$health.stardesk_env
    Write-Host "    stardesk_env=$stardeskEnv app_env=$($health.app_env) deployment=$($health.deployment)"

    if ($stardeskEnv -eq "production") {
        throw "stardesk_env=production — wrong target for staging gate"
    }

    Write-Host ""
    Write-Host "==> Login ($Email)"
    $loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json -Compress
    try {
        $login = Invoke-StardeskApiRequest -ApiUrl $ApiUrl -Path "/api/v1/auth/login" -Method POST `
            -BodyJson $loginBody -WebSession $session
    }
    catch {
        $detail = $_.ErrorDetails.Message
        if ($detail -match "Database is not configured") {
            Write-Host ""
            Write-Host "Staging API has no DATABASE_URL in Vercel Preview env." -ForegroundColor Yellow
            Write-Host "Fix: $($script:StardeskStagingGateDoc)" -ForegroundColor Yellow
            throw "DATABASE_URL missing on Vercel Preview (see $($script:StardeskStagingGateDoc))"
        }
        throw "POST /api/v1/auth/login failed: $detail"
    }

    $token = [string]$login.access_token
    if (-not $token) {
        throw "No access_token in login response"
    }
    Write-Host "GATE OK: Login as $Email" -ForegroundColor Green

    Write-Host ""
    Write-Host "==> Tickets"
    $headers = @{ Authorization = "Bearer $token" }
    $tickets = Invoke-StardeskApiRequest -ApiUrl $ApiUrl -Path "/api/v1/tickets?page=1&page_size=5" `
        -Method GET -Headers $headers -WebSession $session
    $count = 0
    if ($tickets -is [System.Array]) { $count = $tickets.Count }
    elseif ($tickets.items) { $count = @($tickets.items).Count }
    elseif ($tickets.data) { $count = @($tickets.data).Count }

    if ($count -lt 1) {
        throw "Expected >= 1 ticket (got $count). Seed Neon test: bash scripts/bootstrap-dev-database.sh"
    }
    Write-Host "GATE OK: Tickets listed (count=$count)" -ForegroundColor Green
    Write-Host "GATE PASSED (staging Preview hello-world)"
}
