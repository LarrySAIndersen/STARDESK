# Sync SONAR_TOKEN from process/user/machine env into gitignored scripts/sonar-agent/.env
# Never prints the token value.
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SonarEnv = Join-Path $Root "scripts\sonar-agent\.env"
$Example = Join-Path $Root "scripts\sonar-agent\.env.example"

function Get-SonarTokenFromEnv {
    foreach ($scope in @([EnvironmentVariableTarget]::Process,
                          [EnvironmentVariableTarget]::User,
                          [EnvironmentVariableTarget]::Machine)) {
        $v = [Environment]::GetEnvironmentVariable("SONAR_TOKEN", $scope)
        if ($v) { return $v }
    }
    if ($env:SONAR_TOKEN) { return $env:SONAR_TOKEN }
    return $null
}

$token = Get-SonarTokenFromEnv
if (-not $token) {
    Write-Error "Set SONAR_TOKEN (SonarCloud PAT) in the environment or Cursor Cloud Agent secrets."
}

$projectKey = if ($env:SONAR_PROJECT_KEY) { $env:SONAR_PROJECT_KEY } else { "LarrySAIndersen_STARDESK" }
$hostUrl = if ($env:SONAR_HOST_URL) { $env:SONAR_HOST_URL.TrimEnd("/") } else { "https://sonarcloud.io" }
$newCodeOnly = if ($env:SONAR_NEW_CODE_ONLY) { $env:SONAR_NEW_CODE_ONLY } else { "1" }

if (-not (Test-Path $SonarEnv)) {
    Copy-Item $Example $SonarEnv
}

$keys = [ordered]@{
    SONAR_HOST_URL      = $hostUrl
    SONAR_TOKEN         = $token
    SONAR_PROJECT_KEY   = $projectKey
    SONAR_NEW_CODE_ONLY = $newCodeOnly
}

$lines = Get-Content $SonarEnv -ErrorAction SilentlyContinue
if (-not $lines) { $lines = @() }
$out = New-Object System.Collections.Generic.List[string]
$seen = @{}

foreach ($line in $lines) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
        [void]$out.Add($line)
        continue
    }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) {
        [void]$out.Add($line)
        continue
    }
    $key = $line.Substring(0, $eq).Trim()
    if ($keys.Contains($key)) {
        [void]$out.Add("$key=$($keys[$key])")
        $seen[$key] = $true
    } else {
        [void]$out.Add($line)
    }
}

foreach ($entry in $keys.GetEnumerator()) {
    if (-not $seen.ContainsKey($entry.Key)) {
        [void]$out.Add("$($entry.Key)=$($entry.Value)")
    }
}

Set-Content -Path $SonarEnv -Value ($out -join "`n") -Encoding utf8 -NoNewline
Add-Content -Path $SonarEnv -Value "" -Encoding utf8

Write-Host "Updated $SonarEnv (SONAR_PROJECT_KEY=$projectKey, SONAR_HOST_URL=$hostUrl)."
Write-Host "SONAR_TOKEN length: $($token.Length)"
