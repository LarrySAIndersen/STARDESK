# Emits one Cursor agent loop wake payload for Sonar remediation.
# Used by the background scheduler and for smoke tests.
$prompt = @'
Read STARDESK/.cursor/prompts/sonar-remediation-loop.md and execute one full tick: scan (npm run sonar:pipeline), fix next batch (max 5), deliverable gate, commit on cursor/sonar-remediation-loop, push, merge PR to staging and Flow-2 staging-to-main when CI green, update Sonar canvas queue. User override: no manual review for this loop only.
'@
$payload = @{ prompt = $prompt } | ConvertTo-Json -Compress
Write-Output "AGENT_LOOP_TICK_SONAR $payload"
