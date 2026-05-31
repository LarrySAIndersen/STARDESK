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
- `reports/sonar-security-latest.md` (via pipeline)

Use the JSON as machine input and the Markdown for quick human triage.

## Sonar Security Agent (canvas)

Fixed panel beside chat: `canvases/stardesk-sonar-agent.canvas.tsx`

```bash
npm run sonar:pipeline      # scan + sync canvas + security report
npm run sonar:sync-canvas   # merge scan into canvas queue only
```

Skill: `.cursor/skills/stardesk-sonar-agent/SKILL.md`

Pipeline: **Scan → Triage → Fix (batched) → Verify → Rapport**

## Non-security bulk codemods

From `scripts/`:

```bash
npm run sonar:codemod:fastapi          # S8409: drop redundant response_model in routers
npm run sonar:codemod:readonly-props   # S6759: Readonly<> on type XProps aliases (web)
```

Repo root `sonar-project.properties` excludes seed SQL, docs, and helpdesk prototype HTML from analysis.

Rollback: revert branch or run `git checkout main -- <paths>` before re-applying codemods.
