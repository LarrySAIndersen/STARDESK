# Shared helpers for STARDESK local development on Windows (PowerShell 7+).
#Requires -Version 7.0

function Get-StardeskRepoRoot {
    param([string]$StartDir = $PSScriptRoot)

    $dir = $StartDir
    while ($dir) {
        $marker = Join-Path $dir "apps\api\pyproject.toml"
        if (Test-Path -LiteralPath $marker) {
            return (Resolve-Path $dir).Path
        }
        $parent = Split-Path $dir -Parent
        if (-not $parent -or $parent -eq $dir) {
            break
        }
        $dir = $parent
    }

    throw "Could not find STARDESK repo root from $StartDir"
}

function Get-StardeskGitBash {
    $localGit = Join-Path $env:LOCALAPPDATA "Programs\Git"
    $candidates = @(
        (Join-Path $localGit "bin\bash.exe"),
        (Join-Path $localGit "usr\bin\bash.exe"),
        ${env:ProgramFiles} + "\Git\bin\bash.exe",
        ${env:ProgramFiles} + "\Git\usr\bin\bash.exe",
        ${env:ProgramFiles(x86)} + "\Git\bin\bash.exe"
    )
    foreach ($path in $candidates) {
        if ($path -and (Test-Path -LiteralPath $path)) {
            return $path
        }
    }
    return $null
}

function Ensure-StardeskGitBashOnPath {
    $bash = Get-StardeskGitBash
    if (-not $bash) {
        throw "Git Bash not found. Install Git for Windows from https://git-scm.com/download/win"
    }

    $gitBin = Split-Path $bash -Parent
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $pathParts = @($userPath -split ";" | Where-Object { $_ })
    $normalizedBin = ($gitBin -replace "\\", "/").TrimEnd("/").ToLowerInvariant()

    $alreadyPresent = $pathParts | Where-Object {
        (($_ -replace "\\", "/").TrimEnd("/").ToLowerInvariant()) -eq $normalizedBin
    }

    if (-not $alreadyPresent) {
        $updated = @($gitBin) + $pathParts
        $newPath = ($updated | Where-Object { $_ }) -join ";"
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        Write-Host "Added Git Bash to user PATH: $gitBin"
    }

    if ($env:Path -notlike "*$gitBin*") {
        $env:Path = "$gitBin;$env:Path"
    }

    return $bash
}

function Import-StardeskDotEnv {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    Get-Content -LiteralPath $Path -Encoding utf8 | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -gt 0 -and [int][char]$line[0] -eq 0xFEFF) {
            $line = $line.Substring(1).Trim()
        }
        if (-not $line -or $line.StartsWith("#")) {
            return
        }
        $eq = $line.IndexOf("=")
        if ($eq -lt 1) {
            return
        }
        $name = $line.Substring(0, $eq).Trim()
        $value = $line.Substring($eq + 1).Trim()
        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        Set-Item -Path "Env:$name" -Value $value
    }
}

function Test-StardeskApiVenvHealthy {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ApiDir
    )

    $venvDir = Join-Path $ApiDir ".venv"
    $pythonExe = Join-Path $venvDir "Scripts\python.exe"
    if (-not (Test-Path -LiteralPath $pythonExe)) {
        return $false
    }

    $cfgPath = Join-Path $venvDir "pyvenv.cfg"
    if (-not (Test-Path -LiteralPath $cfgPath)) {
        return $false
    }

    $cfg = Get-Content -LiteralPath $cfgPath -Raw
    if ($cfg -match "(?m)^home = /") {
        return $false
    }

    return $true
}

function Repair-StardeskApiVenv {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ApiDir,
        [switch]$Force
    )

    $venvDir = Join-Path $ApiDir ".venv"
    $healthy = Test-StardeskApiVenvHealthy -ApiDir $ApiDir

    if ($healthy -and -not $Force) {
        Write-Host "[OK] API venv looks healthy ($venvDir)" -ForegroundColor Green
        return
    }

    if (Test-Path -LiteralPath $venvDir) {
        Write-Host "Removing incompatible API venv ($venvDir)..." -ForegroundColor Yellow
        Remove-Item -LiteralPath $venvDir -Recurse -Force -ErrorAction Stop
    }

    Write-Host "Creating Windows API venv with uv..." -ForegroundColor Cyan
    Push-Location $ApiDir
    try {
        & uv python install 3.12 | Out-Null
        & uv sync --group dev --python 3.12
        if ($LASTEXITCODE -ne 0) {
            throw "uv sync failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }

    if (-not (Test-StardeskApiVenvHealthy -ApiDir $ApiDir)) {
        throw "API venv repair failed — Scripts/python.exe still missing."
    }

    Write-Host "[OK] API venv repaired" -ForegroundColor Green
}

function Get-StardeskApiVenvPython {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ApiDir
    )

    $pythonExe = Join-Path $ApiDir ".venv\Scripts\python.exe"
    if (-not (Test-Path -LiteralPath $pythonExe)) {
        throw "API venv python missing at $pythonExe — run Repair-StardeskApiVenv"
    }
    return $pythonExe
}

function Get-StardeskApiVenvPytest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ApiDir
    )

    $pytestExe = Join-Path $ApiDir ".venv\Scripts\pytest.exe"
    if (-not (Test-Path -LiteralPath $pytestExe)) {
        throw "API venv pytest missing at $pytestExe — run Repair-StardeskApiVenv"
    }
    return $pytestExe
}

function Get-StardeskApiVenvUvicorn {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ApiDir
    )

    $uvicornExe = Join-Path $ApiDir ".venv\Scripts\uvicorn.exe"
    if (-not (Test-Path -LiteralPath $uvicornExe)) {
        throw "API venv uvicorn missing at $uvicornExe — run Repair-StardeskApiVenv"
    }
    return $uvicornExe
}

function Get-StardeskPrototypeDemoPassword {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoRoot
    )

    if ($env:TEST_USER_PASSWORD) {
        return $env:TEST_USER_PASSWORD
    }

    $apiEnv = Join-Path $RepoRoot "apps\api\.env"
    Import-StardeskDotEnv -Path $apiEnv

    if ($env:PROTOTYPE_BOOTSTRAP_PASSWORD) {
        return $env:PROTOTYPE_BOOTSTRAP_PASSWORD
    }
    if ($env:PROTOTYPE_DEMO_PASSWORD) {
        return $env:PROTOTYPE_DEMO_PASSWORD
    }

    throw "Set PROTOTYPE_BOOTSTRAP_PASSWORD in apps/api/.env (see .env.development.example) or export TEST_USER_PASSWORD."
}

function Test-StardeskVercelProtectedUrl {
    param([Parameter(Mandatory = $true)][string]$Url)
    return ($Url -match '\.vercel\.app$')
}

function Get-StardeskVercelProjectContext {
    param(
        [Parameter(Mandatory = $true)]
        [string]$VercelProjectDir
    )

    $projectJsonPath = Join-Path $VercelProjectDir ".vercel\project.json"
    if (-not (Test-Path -LiteralPath $projectJsonPath)) {
        throw "Missing $projectJsonPath — link the Vercel project (see docs/staging-vercel-preview-env.md)."
    }

    $project = Get-Content -LiteralPath $projectJsonPath -Raw | ConvertFrom-Json
    return @{
        ProjectDir = (Resolve-Path $VercelProjectDir).Path
        OrgId      = [string]$project.orgId
        ProjectId  = [string]$project.projectId
    }
}

function Invoke-StardeskVercelCli {
    param(
        [Parameter(Mandatory = $true)]
        [string]$VercelProjectDir,
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$CliArgs
    )

    $ctx = Get-StardeskVercelProjectContext -VercelProjectDir $VercelProjectDir
    $prevOrg = $env:VERCEL_ORG_ID
    $prevProject = $env:VERCEL_PROJECT_ID
    $env:VERCEL_ORG_ID = $ctx.OrgId
    $env:VERCEL_PROJECT_ID = $ctx.ProjectId

    Push-Location $ctx.ProjectDir
    try {
        & npx --yes vercel@latest @CliArgs 2>&1
    }
    finally {
        Pop-Location
        if ($null -eq $prevOrg) {
            Remove-Item Env:VERCEL_ORG_ID -ErrorAction SilentlyContinue
        }
        else {
            $env:VERCEL_ORG_ID = $prevOrg
        }
        if ($null -eq $prevProject) {
            Remove-Item Env:VERCEL_PROJECT_ID -ErrorAction SilentlyContinue
        }
        else {
            $env:VERCEL_PROJECT_ID = $prevProject
        }
    }
}

function Get-StardeskVercelProtectionBypass {
    param(
        [Parameter(Mandatory = $true)][string]$DeploymentUrl,
        [string]$VercelProjectDir
    )

    if ($env:VERCEL_PROTECTION_BYPASS) {
        return $env:VERCEL_PROTECTION_BYPASS
    }
    if ($env:VERCEL_AUTOMATION_BYPASS_SECRET) {
        return $env:VERCEL_AUTOMATION_BYPASS_SECRET
    }

    $projectDir = if ($VercelProjectDir) { $VercelProjectDir } else {
        Join-Path (Get-StardeskRepoRoot -StartDir $PSScriptRoot) "apps\api"
    }

    $raw = Invoke-StardeskVercelCli -VercelProjectDir $projectDir `
        curl --yes /health --deployment $DeploymentUrl

    foreach ($line in @($raw | ForEach-Object { "$_" })) {
        if ($line -match 'protection bypass token(?: from project settings)?:\s*(\S+)') {
            return $Matches[1]
        }
        if ($line -match 'x-vercel-protection-bypass[=:\s]+(\S+)') {
            return $Matches[1]
        }
    }

    throw "Could not read Vercel protection bypass token from vercel curl. Set VERCEL_PROTECTION_BYPASS or VERCEL_AUTOMATION_BYPASS_SECRET."
}

function Invoke-StardeskVercelCurl {
    param(
        [Parameter(Mandatory = $true)][string]$DeploymentUrl,
        [Parameter(Mandatory = $true)][string]$Path,
        [ValidateSet("GET", "POST", "PATCH", "PUT", "DELETE")]
        [string]$Method = "GET",
        [string]$BodyJson,
        [hashtable]$Headers = @{},
        [string]$VercelProjectDir
    )

    $projectDir = if ($VercelProjectDir) { $VercelProjectDir } else {
        Join-Path (Get-StardeskRepoRoot -StartDir $PSScriptRoot) "apps\api"
    }

    if ($BodyJson) {
        $tmp = Join-Path $env:TEMP ("stardesk-curl-{0}.json" -f [guid]::NewGuid().ToString("N"))
        Set-Content -LiteralPath $tmp -Value $BodyJson -Encoding utf8
        try {
            $raw = Invoke-StardeskVercelCli -VercelProjectDir $projectDir `
                curl --yes $Path --deployment $DeploymentUrl -- `
                --request $Method `
                -H "Content-Type: application/json" `
                --data-binary "@$tmp"
        }
        finally {
            Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
        }
    }
    elseif ($Headers.Authorization) {
        $raw = Invoke-StardeskVercelCli -VercelProjectDir $projectDir `
            curl --yes $Path --deployment $DeploymentUrl -- `
            -H "Authorization: $($Headers.Authorization)"
    }
    else {
        $raw = Invoke-StardeskVercelCli -VercelProjectDir $projectDir `
            curl --yes $Path --deployment $DeploymentUrl
    }

    $lines = @($raw | ForEach-Object { "$_" })
    $jsonLine = $lines | Where-Object { $_ -match '^[\[{]' } | Select-Object -Last 1
    if (-not $jsonLine) {
        $jsonLine = $lines | Where-Object { $_ -match '"stardesk_env"|"access_token"|"detail"|"items"' } | Select-Object -Last 1
    }
    if (-not $jsonLine) {
        throw "vercel curl returned no JSON for $Method $Path"
    }
    return ($jsonLine | ConvertFrom-Json)
}

function Invoke-StardeskApiRequest {
    param(
        [Parameter(Mandatory = $true)][string]$ApiUrl,
        [Parameter(Mandatory = $true)][string]$Path,
        [ValidateSet("GET", "POST", "PATCH", "PUT", "DELETE")]
        [string]$Method = "GET",
        [string]$BodyJson,
        [hashtable]$Headers = @{},
        [Microsoft.PowerShell.Commands.WebRequestSession]$WebSession
    )

    # Vercel Preview deployments require authentication — use CLI curl (npx) directly.
    if (Test-StardeskVercelProtectedUrl -Url $ApiUrl) {
        $projectDir = Join-Path (Get-StardeskRepoRoot -StartDir $PSScriptRoot) "apps\api"
        return Invoke-StardeskVercelCurl -DeploymentUrl $ApiUrl -Path $Path -Method $Method `
            -BodyJson $BodyJson -Headers $Headers -VercelProjectDir $projectDir
    }

    $uri = "$($ApiUrl.TrimEnd('/'))$Path"
    $params = @{
        Uri         = $uri
        Method      = $Method
        TimeoutSec  = 60
        ErrorAction = "Stop"
    }
    if ($WebSession) { $params.WebSession = $WebSession }
    if ($Headers.Count -gt 0) { $params.Headers = $Headers }
    if ($BodyJson) {
        $params.ContentType = "application/json"
        $params.Body = $BodyJson
    }

    try {
        return Invoke-RestMethod @params
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 401 -and (Test-StardeskVercelProtectedUrl -Url $ApiUrl)) {
            return Invoke-StardeskVercelCurl -DeploymentUrl $ApiUrl -Path $Path -Method $Method `
                -BodyJson $BodyJson -Headers $Headers
        }
        throw
    }
}

function Invoke-StardeskBashScript {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoRoot,
        [Parameter(Mandatory = $true)]
        [string]$RelativeScript,
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$ScriptArgs
    )

    $bash = Get-StardeskGitBash
    if (-not $bash) {
        throw "Git Bash not found. Install Git for Windows or use the native PowerShell scripts (*.ps1)."
    }

    $scriptPath = Join-Path $RepoRoot ($RelativeScript -replace "/", "\")
    if (-not (Test-Path -LiteralPath $scriptPath)) {
        throw "Script not found: $scriptPath"
    }

    $bashScript = ($scriptPath -replace "\\", "/")
    if ($bashScript -match "^([A-Za-z]):") {
        $drive = $Matches[1].ToLower()
        $bashScript = "/$drive" + ($bashScript.Substring(2))
    }

    $bashArgs = @("-lc", "cd '$($RepoRoot -replace "\\", "/")' && bash '$bashScript' $($ScriptArgs -join ' ')")
    & $bash @bashArgs
    if ($LASTEXITCODE -ne 0) {
        throw "bash $RelativeScript failed with exit code $LASTEXITCODE"
    }
}
