# End-to-end: pull Vercel env, migrate DB, sync GitHub secret, commit, push, deploy.
# Requires: vercel login, gh auth login, git.
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ApiDir = Join-Path $Root "apps" "api"

Write-Host "==> Pull production DATABASE_URL from Vercel (api project)"
Push-Location $ApiDir
try {
    vercel link --project api --yes | Out-Null
    vercel env pull .env.migrate.tmp --environment=production --yes | Out-Null
} finally {
    Pop-Location
}

Write-Host "==> Alembic upgrade head"
Push-Location $Root
python scripts/run-migrate.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "Migrate skipped or failed (schema may already be applied via API startup)."
}

Write-Host "==> Sync GitHub secret DATABASE_URL"
$syncScript = Join-Path $PSScriptRoot "sync-github-database-secret.ps1"
if (Test-Path $syncScript) {
    & $syncScript
}

Write-Host "==> Git commit and push"
Push-Location $Root
git add -A
$status = git status --porcelain
if ($status) {
    git commit -m "feat(sla): admin SLA settings, pause on hold, CI migrations"
    git push origin main
} else {
    Write-Host "Nothing to commit."
}
Pop-Location

Write-Host "==> Deploy API to Vercel production"
Push-Location $ApiDir
vercel deploy --prod --yes
Pop-Location

Write-Host "==> Deploy Web to Vercel production"
$WebDir = Join-Path $Root "apps" "web"
Push-Location $WebDir
vercel link --project web --yes | Out-Null
vercel deploy --prod --yes
Pop-Location

Write-Host "==> Done."
