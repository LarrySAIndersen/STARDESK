# Coverage Agent

Scan → analyse → canvas sync for API test coverage (`star_itsm_api`).

## Commands

From `scripts/`:

```bash
npm run coverage:pipeline       # pytest + report + canvas sync
npm run coverage:agent          # pytest + parse (no canvas)
npm run coverage:sync-canvas    # merge existing report into canvas
npm run coverage:agent -- --skip-tests   # re-parse apps/api/coverage.json
```

## Reports (gitignored)

| File | Purpose |
|------|---------|
| `reports/coverage-agent-latest.json` | Machine input |
| `reports/coverage-agent-latest.md` | Human summary |
| `apps/api/coverage.json` | Raw coverage.py JSON |
| `apps/api/coverage.xml` | Sonar/Cobertura (CI) |

## CI enforcement (deploy path)

| Layer | Threshold | Where |
|-------|-----------|-------|
| pytest overall | **≥85%** | `pyproject.toml` + `security.yml` |
| Sonar new code | **≥80%** | SonarCloud quality gate |
| Web | excluded | `sonar.coverage.exclusions` |

See [docs/test-coverage.md](../../docs/test-coverage.md).

## Agent batches

Max **1 router + 1 service** per tick. Priority list in `reports/coverage-agent-latest.json` → `priorities[]`.

Skip startup-only: `db_schema_sync.py`, `db_alembic.py`.
