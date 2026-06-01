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

## SonarCloud — coverage import (t-27)

`sonar-project.properties` at repo root configures:

- `sonar.python.coverage.reportPaths=apps/api/coverage.xml`
- `sonar.tests=apps/api/tests`

There is **no SonarScanner step in CI yet** — the Sonar Agent uses the SonarCloud REST API for issue triage. To push coverage to SonarCloud (manual or future CI):

1. Generate coverage locally (command above) or download the CI artifact.
2. Ensure `apps/api/coverage.xml` exists at repo root relative path.
3. Run SonarScanner with `SONAR_TOKEN` (never commit the token):

```bash
# Install SonarScanner CLI once — see https://docs.sonarsource.com/sonarqube-cloud/advanced-setup/ci-overview/
export SONAR_TOKEN=your-pat   # from SonarCloud → My Account → Security
sonar-scanner \
  -Dsonar.host.url=https://sonarcloud.io \
  -Dsonar.token="$SONAR_TOKEN"
```

SonarCloud project: [LarrySAIndersen_STARDESK](https://sonarcloud.io/project/overview?id=LarrySAIndersen_STARDESK)

After merge to `main`, run the scanner (or add a dedicated workflow) to refresh coverage metrics in the dashboard.

## Web — phase 2 (deferred)

`apps/web` has no test runner today. Planned follow-up:

- Vitest + `@vitest/coverage-v8`
- LCOV at `apps/web/coverage/lcov.info`
- Uncomment `sonar.javascript.lcov.reportPaths` in `sonar-project.properties`
- CI step in `web-security` job before any Sonar scan

Until then, SonarCloud shows Python coverage only.
