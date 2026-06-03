# Test coverage (t-26 / t-27)

Phase 1 delivers **API coverage** in CI and SonarCloud import wiring. Web coverage (Vitest + LCOV) is deferred to a follow-up PR.

## API — local

From repo root or `apps/api`:

```bash
cd apps/api
uv sync --group dev
uv run pytest --cov=star_itsm_api --cov-report=term-missing --cov-report=xml:coverage.xml
```

Output:

| Artifact | Path |
|----------|------|
| Terminal report | stdout (`term-missing`) |
| Sonar/Cobertura XML | `apps/api/coverage.xml` |

Configuration lives in `apps/api/pyproject.toml` (`[tool.coverage.run]` / `[tool.coverage.report]`).

## API — CI

The **Security** workflow (`.github/workflows/security.yml`, job `api-security`) runs pytest with coverage on every push/PR to `main` and `staging`:

1. Generates `apps/api/coverage.xml`
2. Fails if the file is missing (`test -f coverage.xml` in `apps/api` working dir)
3. Uploads the XML as artifact `api-coverage-xml` (retention: default 90 days)

Download from a workflow run: **Actions → Security → api-security → Artifacts**.

## SonarCloud — coverage import (CI)

`sonar-project.properties` at repo root configures:

- `sonar.python.coverage.reportPaths=apps/api/coverage.xml`
- `sonar.tests=apps/api/tests`

**CI (primary):** `.github/workflows/security.yml` job `api-security` — after pytest coverage, `SonarSource/sonarqube-scan-action` imports `apps/api/coverage.xml` on every push/PR to `staging` and `main`.

**CI (dedicated):** `.github/workflows/sonarcloud.yml` — same flow as a standalone job (runs after merge to `staging`/`main`; new workflow files in PRs may need Actions approval once).

**Required GitHub secret:** `SONAR` (SonarCloud PAT — same as Sonar hotspots workflow). Without it the Sonar scan step fails (auth error).

SonarCloud project: [LarrySAIndersen_STARDESK](https://sonarcloud.io/project/overview?id=LarrySAIndersen_STARDESK)

Optional: mark the **SonarCloud** check as required under branch protection for `staging` / `main`.

### Manual scan (local / agent VM)

```bash
cd apps/api && uv run pytest --cov=star_itsm_api --cov-report=xml:coverage.xml
cd ../.. && cd scripts && npm run sonar:scan
```

Never commit `SONAR_TOKEN`.

## Web — phase 2 (deferred)

`apps/web` has no test runner today. Planned follow-up:

- Vitest + `@vitest/coverage-v8`
- LCOV at `apps/web/coverage/lcov.info`
- Uncomment `sonar.javascript.lcov.reportPaths` in `sonar-project.properties`
- CI step in `web-security` job before any Sonar scan

Until then, SonarCloud shows Python coverage only.
