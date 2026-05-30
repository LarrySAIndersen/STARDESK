# Sonar Agent

Pulls SonarQube issues and builds a prioritized local queue for remediation.

## Setup

Copy env template:

```bash
cp scripts/sonar-agent/.env.example .env.local
```

Set:

- `SONAR_HOST_URL`
- `SONAR_TOKEN`
- `SONAR_PROJECT_KEY`

Optional:

- `SONAR_BRANCH`
- `SONAR_PULL_REQUEST`
- `SONAR_NEW_CODE_ONLY` (`1` by default)

## Run

From `scripts/`:

```bash
npm run sonar:agent
npm run sonar:agent:api
```

Where:

- `sonar:agent` = all scopes
- `sonar:agent:api` = only issues in `apps/api/`

## Output

- `reports/sonar-agent-latest.json`
- `reports/sonar-agent-latest.md`

Use the JSON as machine input and the Markdown for quick human triage.
