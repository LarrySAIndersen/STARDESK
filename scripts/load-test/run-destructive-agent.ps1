# Destructive test orchestrator (k6 + pytest). Non-local targets require ALLOW_DESTRUCTIVE=1.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
node ./run-destructive-agent.mjs
exit $LASTEXITCODE
