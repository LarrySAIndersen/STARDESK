# Production hello-world gate

**Run:** 2026-06-02  
**Result:** PASSED

## Targets

| Layer | URL |
|-------|-----|
| API | https://api-gamma-amber.vercel.app |
| Web | https://web-seven-neon-6bvmcoel7n.vercel.app |

## Checks

| Step | User | Result |
|------|------|--------|
| `/health` → `stardesk_env=production` | — | OK |
| API login + tickets | `sf01@example.dk` | OK (100 tickets) |
| PRODUKTION banner | — | OK |
| Web BFF login (`/api/auth/login`) | `sf02@example.dk` | OK |
| `/tickets` — Alle sager + INC-* rows | sf02 session | OK |

## Artifacts

`scripts/artifacts/hello-world-gate-prod/2026-06-02T19-42-46-497Z/` (screenshots)

## Re-run

```bash
cd scripts
TEST_USER_PASSWORD='Stardesk2026!' npm run gate:hello-world:prod
```

Note: Standard `run-deliverable-gate.sh` **rejects** production by design. Use `hello-world-gate-prod.mjs` after prod releases.
