# Sonar Security Report

- Generated: 2026-05-31T19:38:33.551Z
- Project: LarrySAIndersen_STARDESK
- Scope: all
- Open security issues: **59**

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 10 |
| CRITICAL | 10 |
| MAJOR | 25 |
| MINOR | 14 |

## Remediation batches

### Batch 1 — BLOCKER (fix first)

- `apps/api/alembic/versions/20260531_reset_prototype_passwords.py:15` · secrets:S8215 · Make sure this bcrypt password hash gets revoked, changed, and removed from the code.
- `apps/api/alembic/versions/20260531_reset_prototype_passwords.py:16` · secrets:S8215 · Make sure this bcrypt password hash gets revoked, changed, and removed from the code.
- `apps/api/src/star_itsm_api/core/prototype_credentials.py:5` · secrets:S8215 · Make sure this bcrypt password hash gets revoked, changed, and removed from the code.
- `apps/api/src/star_itsm_api/core/prototype_credentials.py:9` · secrets:S8215 · Make sure this bcrypt password hash gets revoked, changed, and removed from the code.
- `scripts/bootstrap-dev-database.sh:58` · secrets:S6698 · Make sure this PostgreSQL password gets changed and removed from the code.
- `scripts/import-playwright-evidence-to-workboard.mjs:137` · jssecurity:S2083 · Change this code to not construct the path from user-controlled data.
- `scripts/run-review-playwright.mjs:248` · jssecurity:S2083 · Change this code to not construct the path from user-controlled data.
- `scripts/run-review-playwright.mjs:271` · jssecurity:S2083 · Change this code to not construct the path from user-controlled data.
- `apps/api/src/star_itsm_api/services/avatars.py:97` · pythonsecurity:S2083 · Change this code to not construct the path from user-controlled data.
- `scripts/gen_seed_orgs.py:5` · secrets:S8215 · Make sure this bcrypt password hash gets revoked, changed, and removed from the code.

### Batch 2 — CRITICAL

- `apps/api/tests/test_attachments.py:75` · python:S5443
- `apps/api/tests/test_attachments.py:86` · python:S5443
- `apps/api/tests/test_attachments.py:181` · python:S5443
- `apps/api/tests/test_attachments.py:251` · python:S5443
- `apps/api/tests/test_attachments.py:309` · python:S5443
- `apps/api/tests/test_attachments.py:30` · python:S5443
- `apps/api/tests/test_attachments.py:65` · python:S5443
- `apps/api/tests/test_attachments.py:169` · python:S5443
- `apps/api/src/star_itsm_api/core/config.py:135` · python:S5443
- `apps/api/src/star_itsm_api/core/config.py:44` · python:S5443

### Batch 3 — MAJOR (triage demo/test false positives)

- 25 issues — mange er demo passwords og test fixtures

## Agent handoff

1. Læs `.cursor/skills/stardesk-sonar-agent/SKILL.md`
2. Fix Batch 1, kør pytest + deliverable gate
3. Opdater canvas queue (`fixStatus`) og kør `npm run sonar:pipeline` igen

