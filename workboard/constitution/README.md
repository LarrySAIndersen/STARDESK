# STARDESK Constitution — udviklingsparadigme

Prioriterede 50-punkts planer for **sikkerhed**, **performance** og **kodepraksis**.
Bruges som fælles reference for debate-first forbedringsarbejde — ikke som Work Board kanban.

## Filer

| Fil | Fokus | Prioritet |
|-----|-------|-----------|
| [STARDESK-sikkerhed-50.md](./STARDESK-sikkerhed-50.md) | Trusselsbillede, auth, uploads, CORS, SQL | KRITISK 1-10 først |
| [STARDESK-performance-50.md](./STARDESK-performance-50.md) | N+1, caching, pool, frontend load | KRITISK 1-10 først |
| [STARDESK-kodepraksis-50.md](./STARDESK-kodepraksis-50.md) | Typing, DRY, SRP, test, lint | Scorecard 7/10 |
| [STARDESK-kodepraksis-50-plan.md](./STARDESK-kodepraksis-50-plan.md) | Eksekveringsplan + fallback per punkt | `npm run kodepraksis:tick` |

## Fælles workflow (debate-first)

1. Læs hele dokumentet for det valgte område
2. For hvert punkt: debattér relevans, angrebsvektor/flaskehals, tradeoffs
3. Formulér anbefaling: implementér / benchmark / udskyd / afvis
4. Præsentér plan som tabel **før** kode
5. Implementér kun efter godkendelse
6. Lever via PR mod `staging` + deliverable gate

## Kodepraksis agent (én ad gangen)

```bash
cd scripts
npm run kodepraksis:init
npm run kodepraksis:tick          # næste punkt → reports/kodepraksis-agent-latest.md
npm run kodepraksis:result -- --n 39 --status done --pr "<url>"
```

Fallback: primær → partial → defer → wontfix. Se `scripts/kodepraksis-agent/README.md`.

## Relation til resten af repoet

- Operativ agent-regel: `AGENTS.md`, `CLAUDE.md`
- Release/PR: `docs/pr-only-period.md`
- Work Board canvas: pensioneret — se `workboard/README.md`
