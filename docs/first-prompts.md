# Prompts til Cursor Composer

Kopier disse prompts ind i Cursor Composer i rækkefølge. Vent på at hver
er færdig og virker før du går videre til næste.

> **Vigtigt:** Sørg for at `CLAUDE.md` er valgt som "Rules for AI" i Cursor
> settings før du begynder. Den indeholder guardrails og konventioner som
> alle disse prompts bygger på.
>
> **Deploy (2026):** Prompts #2 og #3 nævner historisk Railway. Produktion kører
> **Vercel serverless** for API (`apps/api`) og **Neon** for database.
> Se [deploy.md](./deploy.md) for aktuel opsætning.

---

## Prompt #1 — Scaffold backend (apps/api)

```
Læs ARCHITECTURE.md, CLAUDE.md og init.sql i repo-roden, så du kender
domænemodellen, stakken og konventionerne.

Opgave: Scaffold apps/api som et FastAPI-projekt klar til deploy på Railway.

Krav:
- Python 3.12, FastAPI, SQLAlchemy 2.0 async, Alembic, Pydantic v2
- Bruger asyncpg til at tale med Neon Postgres
- Læser DATABASE_URL fra environment variable
- Struktur: src/star_itsm_api/{main.py, db.py, models/, schemas/, routers/, core/}
- pyproject.toml med uv eller poetry (vælg uv hvis du er i tvivl)
- Procfile til Railway: web: uvicorn star_itsm_api.main:app --host 0.0.0.0 --port $PORT
- railway.toml med build-config
- CORS-middleware der tillader FRONTEND_URL fra env
- Endpoints:
  - GET /health → {"status": "ok"}
  - GET /api/v1/tickets → tom liste []
- Alembic er initialiseret men ingen migrations skrives endnu (vi bruger
  init.sql første gang, Alembic overtager bagefter)
- pytest + httpx setup med én test der verificerer GET /health

Lav .env.example i apps/api/ med de variabler API'et læser.

Når du er færdig: rapportér præcis hvilke filer der er oprettet.
Skriv IKKE migrations endnu. Spørg før du installerer dependencies
udover det jeg har listet.
```

---

## Prompt #2 — Scaffold frontend (apps/web)

```
Læs ARCHITECTURE.md og CLAUDE.md igen så du har konteksten.

Opgave: Scaffold apps/web som et Next.js 15-projekt klar til deploy på Vercel.

Krav:
- Next.js 15 (App Router), TypeScript, React 19
- Tailwind CSS v4
- shadcn/ui installeret med components.json (men kun de komponenter vi
  bruger nu: button, card, table, badge)
- IBM Plex Sans + IBM Plex Mono som fonts (matcher STAR-prototypen)
- Struktur: src/{app, components, lib, types}
- src/lib/api.ts: typed fetch-wrapper der læser NEXT_PUBLIC_API_URL
- src/app/page.tsx: viser overskriften "STARdesk — Sagsstyring" og henter
  GET /api/v1/tickets fra backend. Viser "Ingen sager" når listen er tom.
- src/app/layout.tsx: simpel layout med dansk lang="da"
- vercel.json hvis det er nødvendigt (root: apps/web)
- Dansk UI overalt
- Visuelt: minimal og ren, hold sig til shadcn defaults indtil videre

Når du er færdig: rapportér præcis hvilke filer der er oprettet.
Spørg før du tilføjer flere dependencies end dem jeg har nævnt.
```

---

## Prompt #3 — Forbind frontend og backend lokalt + deploy

```
Læs ARCHITECTURE.md.

Opgave: Verificer at apps/api og apps/web kan tale sammen, og forbered deploy.

Trin:

1. I apps/api/: skab en startup-instruktion der printer en advarsel hvis
   DATABASE_URL ikke er sat (men crash ikke - lad den starte uden DB-forbindelse
   så jeg kan teste lokalt uden Neon).

2. Implementer GET /api/v1/tickets så den faktisk querier 'tickets' tabellen
   i Neon (når DATABASE_URL er sat). Den skal returnere en liste af tickets
   med id, ticket_number, title, status, priority, created_at.
   Returner tom liste hvis tabellen er tom eller DB ikke tilgængelig.

3. Lav en Pydantic-schema TicketRead der matcher response.

4. I apps/web/: opdater src/app/page.tsx så den viser tickets i en
   shadcn Table-komponent når der er nogen, og "Ingen sager endnu"
   når listen er tom. Vis loading-state mens den henter.

5. Skriv en SQL-snippet i docs/test-data.sql som jeg kan paste i Neon SQL
   Editor for at oprette én test-ticket, så jeg kan verificere flowet.

6. Skriv en kort docs/deploy.md med præcise trin til at deploye:
   - Backend til Railway (hvilke env vars, hvilken root directory)
   - Frontend til Vercel (hvilke env vars, hvilken root directory)
   - Rækkefølgen: deploy backend først, kopier URL til frontend env vars

Rapporter præcis hvilke filer der blev oprettet/ændret.
```

---

## Hvad der sker efter de tre prompts

Når prompt #3 er færdig, har du:
- Backend på Railway der henter tickets fra Neon
- Frontend på Vercel der viser dem
- En `test-data.sql` du kan paste i Neon for at oprette test-tickets
- En `deploy.md` med præcis hvordan det hele konfigureres

Næste prompts (kommer senere):
- **#4** - opret-ticket form (POST /api/v1/tickets + UI)
- **#5** - ticket detail-view + kommentar-tråd
- **#6** - kategori/subkategori-vælger + routing-regler
- **#7** - SLA-engine + escalation cron-job
- **#8** - email-in via Resend webhook

---

## Tips til at arbejde med Cursor Composer

- **Vent altid på at den er færdig** før du sender næste prompt. Composer
  kører på multi-file edits og bryder hvis du afbryder.
- **Review hvert step.** Klik dig igennem de filer den foreslår og accepter/afvis
  pr. fil. Du har god grund til at sige nej hvis noget ser forkert ud.
- **Hvis den vil installere noget uventet:** stop, læs hvad det er, spørg om
  hvorfor inden du accepterer.
- **Hvis den fejler eller løber sur:** sig "stop, ryd op, og forklar hvad du
  prøvede". Den er god til at recovere.
