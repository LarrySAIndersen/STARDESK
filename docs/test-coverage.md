# Test coverage (t-26 / t-27)

Phase 1 delivers **API coverage** in CI and SonarCloud import wiring. Web coverage (Vitest + LCOV) is deferred to a follow-up PR.

## One-time SonarCloud setup (required for CI coverage)

SonarCloud **cannot** run Automatic Analysis and CI analysis at the same time.

1. Open [Analysis Method](https://sonarcloud.io/project/analysis_method?id=LarrySAIndersen_STARDESK) for **LarrySAIndersen_STARDESK**
2. **Disable** Automatic Analysis (uncheck “Enabled for this project”)
3. **Enable** analysis via GitHub Actions / CI (SonarScanner)

Until step 2 is done, the `SonarCloud Scan` CI step fails with: *"You are running CI analysis while Automatic Analysis is enabled."*

After CI is enabled, the Coverage panel is filled from `apps/api/coverage.xml` on each `staging`/`main` build.

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

- `sonar.python.version=3.12` (also passed explicitly in CI `args` on Sonar scan steps)
- `sonar.python.coverage.reportPaths=apps/api/coverage.xml`
- `sonar.tests=apps/api/tests`

**Path rewrite (required):** Coverage XML from pytest uses `filename="src/star_itsm_api/..."`. Cobertura resolves `<source>` + `filename`, so CI runs `python scripts/fix_coverage_xml_for_sonar.py` to set `<source>apps/api/src</source>` and strip the leading `src/` from each filename (not the full repo path in both fields).

**CI (primary):** `.github/workflows/security.yml` job `api-security` — after pytest coverage + path rewrite, `SonarSource/sonarqube-scan-action` imports `apps/api/coverage.xml` on every push/PR to `staging` and `main`.

**CI (dedicated):** `.github/workflows/sonarcloud.yml` — same flow as a standalone job (runs after merge to `staging`/`main`; new workflow files in PRs may need Actions approval once).

**Required GitHub secret:** `SONAR` (SonarCloud PAT — same as Sonar hotspots workflow). Without it the Sonar scan step fails (auth error).

SonarCloud project: [LarrySAIndersen_STARDESK](https://sonarcloud.io/project/overview?id=LarrySAIndersen_STARDESK)

Optional: mark the **SonarCloud** check as required under branch protection for `staging` / `main`.

### Manual scan (local / agent VM)

```bash
cd apps/api && uv run pytest --cov=star_itsm_api --cov-report=xml:coverage.xml
cd ../.. && python scripts/fix_coverage_xml_for_sonar.py apps/api/coverage.xml
cd scripts && npm run sonar:scan
```

Never commit `SONAR_TOKEN`.

## Web — phase 2 (deferred)

`apps/web` has no test runner today. Planned follow-up:

- Vitest + `@vitest/coverage-v8`
- LCOV at `apps/web/coverage/lcov.info`
- Uncomment `sonar.javascript.lcov.reportPaths` in `sonar-project.properties`
- CI step in `web-security` job before any Sonar scan

Until then, SonarCloud shows Python coverage only.
