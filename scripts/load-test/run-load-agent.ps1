# Runs baseline, soak, and stress load-test scenarios (headless).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
node ./run-load-agent.mjs
exit $LASTEXITCODE
