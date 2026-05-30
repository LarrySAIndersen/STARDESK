# STARDESK n8n — Quality Loop (Sonar + Destructive)

Automatiseret loop der kører **Sonar-agent** og **destructive smoke tests**, skriver rapporter og en **Cursor agent-prompt** med de rigtige skills.

## Filer

| Fil | Formål |
|-----|--------|
| `run-quality-loop.mjs` | Orchestrator (Sonar → destructive → rapporter) |
| `stardesk-quality-loop.json` | n8n workflow (import) |
| `.env.example` | Miljøvariabler til n8n/host |

## Cursor skills (efter kørsel)

1. `.cursor/skills/stardesk-destructive-test-review/SKILL.md`
2. `.cursor/skills/stardesk-sonar-review-loop/SKILL.md`

Åbn `STARDESK/reports/quality-loop-agent-prompt.md` i en ny agent-chat efter hver kørsel.

## Manuel kørsel

```bash
cd STARDESK/scripts
cp n8n-workflows/.env.example ../.env.local   # tilpas Sonar + BASE_URL
# eller export SONAR_* og ALLOW_DESTRUCTIVE=1

npm run quality:loop
```

## n8n opsætning

1. Import `stardesk-quality-loop.json` i n8n.
2. Sæt host-env `STARDESK_REPO` til absolut sti til `STARDESK`-mappen.
3. Konfigurer Sonar-secrets (`SONAR_TOKEN`, `SONAR_PROJECT_KEY`, …) på n8n-serveren — **aldrig** i workflow-JSON.
4. **Execute Command** på Windows — brug `run-quality-loop.ps1` eller:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "%STARDESK_REPO%\scripts\n8n-workflows\run-quality-loop.ps1"
```

Linux/macOS:

```bash
cd "$STARDESK_REPO/scripts/n8n-workflows" && node run-quality-loop.mjs
```

5. Valgfrit: aktiver **Webhook notify** og sæt `QUALITY_LOOP_WEBHOOK_URL`.

## Schedule

Standard: **hver 2. dag kl. 06:00** (matcher Work Board #22).

## Destructive sikkerhed

| `QUALITY_LOOP_DESTRUCTIVE` | Adfærd |
|---------------------------|--------|
| `smoke` (default) | Kun k6 spike --smoke |
| `full` | Fuld `run-destructive-agent.mjs` + pytest |
| `off` | Spring destructive over |

Kræver `ALLOW_DESTRUCTIVE=1`. Remote URL (ikke localhost/preprod) blokeres medmindre `QUALITY_LOOP_ALLOW_REMOTE=1`.

## Output

- `reports/quality-loop-latest.json`
- `reports/quality-loop-latest.md`
- `reports/quality-loop-agent-prompt.md`
- `reports/sonar-agent-latest.{json,md}` (fra Sonar-fase)

## Uden n8n

Windows Task Scheduler eller Cursor `/loop 2d` med prompt:

> Kør `npm run quality:loop` i STARDESK/scripts og følg `reports/quality-loop-agent-prompt.md` med destructive- og Sonar-skills.
