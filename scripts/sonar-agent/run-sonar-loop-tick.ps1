# Emits one Cursor agent loop wake payload for Sonar remediation.
# Used by the background scheduler and for smoke tests.
$prompt = @'
Read STARDESK/.cursor/prompts/sonar-remediation-loop.md and execute one full tick: scan (npm run sonar:pipeline), fix next batch (max 5), deliverable gate, one commit on cursor/sonar-remediation-loop, push, keep draft PR until 10 commits then ready+auto-merge to staging only (never merge staging-to-main), update Sonar canvas queue. Staging batch policy: docs/staging-batch-policy.md.
'@
$payload = @{ prompt = $prompt } | ConvertTo-Json -Compress
Write-Output "AGENT_LOOP_TICK_SONAR $payload"
