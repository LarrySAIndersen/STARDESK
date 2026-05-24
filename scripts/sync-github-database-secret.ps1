# Sync DATABASE_URL from Vercel API project to GitHub Actions secret (one-time / refresh).
# Requires: vercel CLI (logged in), gh CLI (gh auth login).
$ErrorActionPreference = "Stop"
$ApiDir = Join-Path $PSScriptRoot ".." "apps" "api" | Resolve-Path
$EnvFile = Join-Path $ApiDir ".env.migrate.tmp"

Push-Location $ApiDir
try {
    vercel link --project api --yes | Out-Null
    vercel env pull $EnvFile --environment=production --yes | Out-Null
} finally {
    Pop-Location
}

$databaseUrl = $null
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*DATABASE_URL=(.*)$') {
        $raw = $matches[1].Trim()
        if ($raw.StartsWith('"') -and $raw.EndsWith('"')) {
            $raw = $raw.Substring(1, $raw.Length - 2)
        }
        if ($raw) { $databaseUrl = $raw }
    }
}

if (-not $databaseUrl) {
    Write-Error "DATABASE_URL is empty in Vercel production. Set it in Vercel dashboard first."
}

$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
    Write-Error "GitHub CLI (gh) not found. Install: winget install GitHub.cli"
}

$databaseUrl | gh secret set DATABASE_URL --repo LarrySAIndersen/STARDESK
Write-Host "GitHub secret DATABASE_URL updated."
