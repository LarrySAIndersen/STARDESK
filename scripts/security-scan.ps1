# Local security scan (API + web). Run from repo root.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "=== API: pytest ===" -ForegroundColor Cyan
Push-Location "$root\apps\api"
python -m pytest -q
if (Get-Command bandit -ErrorAction SilentlyContinue) {
    Write-Host "=== API: bandit ===" -ForegroundColor Cyan
    bandit -r src -ll -q
} else {
    Write-Host "Skip bandit (pip install bandit)" -ForegroundColor Yellow
}
Pop-Location

Write-Host "=== Web: lint + audit ===" -ForegroundColor Cyan
Push-Location "$root\apps\web"
npm run lint
npm audit --audit-level=high
Pop-Location

Write-Host "Done." -ForegroundColor Green
