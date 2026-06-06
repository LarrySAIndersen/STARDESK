# Test coverage (t-26 / t-27)

API coverage in CI + SonarCloud quality gate. Web Vitest runs in CI but is **excluded from Sonar coverage gate** until meaningful LCOV exists.

## Deploy enforcement (coverage + quality)

| Layer | Threshold | Blocks merge? |
|-------|-----------|---------------|
| **pytest** (`--cov-fail-under=85`) | API overall ≥ **85%** | Yes — `Security` workflow fails |
| **SonarCloud quality gate** | New code coverage ≥ **80%** (+ existing QG rules) | Yes — `SonarCloud Quality Gate` step fails |
| **Deliverable gate** | API hello-world + non-prod `/health` | Yes — when `DATABASE_URL` secret set |
| **Web in Sonar gate** | Excluded | `sonar.coverage.exclusions=apps/web/src/**` |

**Recommended:** GitHub → **Settings → Branches** → require checks on `staging` and `main`:

- `api-security` (Security workflow)
- `SonarCloud Code Analysis` (if shown separately)
- `hello-world-api` (Deliverable gate, when enabled)

Auto-merge to `staging` waits on `api-security` success — quality gate failure blocks merge automatically.

Config: `apps/api/pyproject.toml` → `[tool.coverage.report]` → `fail_under = 85`.

## Coverage Agent (local / VM)

From `scripts/`:

```bash
npm run coverage:pipeline       # pytest + report + canvas sync
npm run coverage:agent          # scan only
npm run coverage:agent -- --skip-tests   # re-parse existing coverage.json
```

Reports: `reports/coverage-agent-latest.json`, `reports/coverage-agent-latest.md`. See `scripts/coverage-agent/README.md`.

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
uv run pytest --cov=star_itsm_api --cov-report=term-missing --cov-report=xml:coverage.xml --cov-fail-under=85
```

Output:

| Artifact | Path |
|----------|------|
| Terminal report | stdout (`term-missing`) |
| Sonar/Cobertura XML | `apps/api/coverage.xml` |
| Agent JSON | `apps/api/coverage.json` (via `npm run coverage:pipeline`) |

Configuration lives in `apps/api/pyproject.toml` (`[tool.coverage.run]` / `[tool.coverage.report]`).

## API — CI

The **Security** workflow (`.github/workflows/security.yml`, job `api-security`) runs pytest with coverage on every push/PR to `main` and `staging`:

1. Generates `apps/api/coverage.xml` with `--cov-fail-under=85`
2. Fails if the file is missing (`test -f coverage.xml` in `apps/api` working dir)
3. SonarCloud scan + **quality gate check**
4. Uploads the XML as artifact `api-coverage-xml` (retention: default 90 days)

Download from a workflow run: **Actions → Security → api-security → Artifacts**.

## SonarCloud — coverage import (CI)

`sonar-project.properties` at repo root configures:

- `sonar.python.version=3.12` (also passed explicitly in CI `args` on Sonar scan steps)
- `sonar.python.coverage.reportPaths=apps/api/coverage.xml`
- `sonar.coverage.exclusions=apps/web/src/**,scripts/**`
- `sonar.tests=apps/api/tests`

**Path rewrite (required):** Coverage XML from pytest uses `filename="src/star_itsm_api/..."`. Cobertura resolves `<source>` + `filename`, so CI runs `python scripts/fix_coverage_xml_for_sonar.py` to set `<source>apps/api/src</source>` and strip the leading `src/` from each filename (not the full repo path in both fields).

**CI (primary):** `.github/workflows/security.yml` job `api-security` — pytest → path rewrite → Sonar scan → quality gate.

**CI (dedicated):** `.github/workflows/sonarcloud.yml` — same flow as a standalone job.

**Required GitHub secret:** `SONAR` (SonarCloud PAT — same as Sonar hotspots workflow). Without it the Sonar scan step fails (auth error).

SonarCloud project: [LarrySAIndersen_STARDESK](https://sonarcloud.io/project/overview?id=LarrySAIndersen_STARDESK)

### Manual scan (local / agent VM)

```bash
cd apps/api && uv run pytest --cov=star_itsm_api --cov-report=xml:coverage.xml
cd ../.. && python scripts/fix_coverage_xml_for_sonar.py apps/api/coverage.xml
cd scripts && npm run sonar:scan
```

Never commit `SONAR_TOKEN`.

## Web — phase 2 (partial)

Vitest + `@vitest/coverage-v8` runs in CI (`npm run test:coverage`). LCOV at `apps/web/coverage/lcov.info`.

Web remains **excluded from Sonar coverage gate** until Vitest covers a meaningful share of `apps/web/src`. Do not remove `sonar.coverage.exclusions` for web without a coverage baseline plan.

Playwright hello-world gate (`bash scripts/run-deliverable-gate.sh --full`) covers critical UI flows locally/Cloud Agent.
