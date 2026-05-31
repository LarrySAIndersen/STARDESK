# Instructions for Cursor — star-itsm-cloud

Du arbejder på **star-itsm-cloud**, en cloud-prototype af STAR's ITSM-system.
Læs `ARCHITECTURE.md` før du gør noget i denne repo.

## Before done (alle leverancer — obligatorisk)

```bash
bash scripts/run-deliverable-gate.sh
```

UI/auth/routing: tilføj `--full`. Se `docs/deliverable-gate.md` og `AGENTS.md`.

## Sprog

- **Kode, database, API**: Engelsk
- **UI-tekst, mail-templates, brugervendte tekster**: Dansk
- **Commit messages**: Engelsk
- **Kommentarer i kode**: Engelsk

## Stack

**apps/web/** - Next.js 15 (App Router) + TypeScript + React 19
- UI: shadcn/ui + Tailwind CSS v4
- Forms: react-hook-form + zod
- API client: fetch wrapper i `src/lib/api.ts`
- Deployes til Vercel

**apps/api/** - Python 3.12 + FastAPI
- ORM: SQLAlchemy 2.0 (async)
- Migrations: Alembic
- Schemas: Pydantic v2
- Mail: Resend (gratis tier i prototype)
- Deployes til Vercel serverless (FastAPI service, `index.py` + `vercel.json`)

**Database** - PostgreSQL 16 på Neon (serverless)
- Initial schema fra `init.sql` (kør én gang manuelt)
- Alle videre ændringer via Alembic

## Guardrails — minimal friction mode

Du kan handle frit. Spørg KUN før du:

1. Sletter filer eller mapper
2. Kører destruktive DB-kommandoer (DROP, TRUNCATE, DELETE uden WHERE)
3. Force-pushes eller resetter git history
4. Tilføjer paid tier services eller services der koster penge
5. Skriver secrets/credentials nogen steder

For alt andet: bare gør det. Hvis du fortryder, så rul tilbage med git.
Rapportér efter ændringer: præcis hvilke filer der blev oprettet, ændret
eller slettet.

## Konventioner

### Python (apps/api)
- snake_case for variabler/funktioner, PascalCase for klasser
- Type hints på alle public functions (ingen `Any` uden kommentar)
- Pydantic models for ALL request/response bodies
- SQLAlchemy models i `models/`, Pydantic schemas i `schemas/`
- Async overalt — kun `async def` for I/O

### TypeScript (apps/web)
- Server Components by default
- `'use client'` kun når nødvendigt
- `import type` for type-only imports
- Ingen `any` — brug `unknown` + narrow

### Database
- snake_case, plural tabeller (`tickets`, ikke `ticket`)
- Alle tabeller har `id` (UUID), `created_at`, `updated_at`
- Soft delete via `deleted_at`
- Foreign keys altid med eksplicit `ON DELETE` policy

### API
- REST, resource-orienteret under `/api/v1/`
- Datofelter i ISO 8601 UTC
- Paginering: `?page=1&page_size=50`, max 100
- Fejl: RFC 7807 problem-details JSON

## Deployment

**apps/web → Vercel:**
- Push til `main` triggerer auto-deploy
- Preview deployments på alle pull requests
- Root directory i Vercel settings: `apps/web`

**apps/api → Vercel:**
- Push til `main` triggerer auto-deploy (separat Vercel-projekt `api`)
- Root directory: `apps/api`
- Prod-URL: `https://api-gamma-amber.vercel.app`

**Database → Neon:**
- Connection string i `DATABASE_URL` (Vercel env på `api`-projekt)
- Alembic kører **ikke** ved API-opstart (Vercel cold start)
- Efter schema-ændringer: GitHub Actions (`security.yml` / `database-migrate.yml`) eller `scripts/run-migrate.py` efter `vercel env pull`

## Testing

- Hver endpoint: mindst én happy-path test (pytest + httpx)
- Mutations: mindst én auth-fejl test
- **Alle leverancer:** kør deliverable gate før du siger færdig — `bash scripts/run-deliverable-gate.sh` (UI: `--full`). Se `docs/deliverable-gate.md`.

## Hvad du SKAL gøre når du begynder en task

1. Læs `ARCHITECTURE.md` hvis du ikke har endnu
2. Tjek om der findes lignende kode — ikke parallel-implementér
3. Lav planen først (3-5 punkter) hvis task er > 30 min arbejde
4. Skriv koden
5. Kør tests, linter og **deliverable gate** inden du siger du er færdig
6. Rapporter: præcis hvilke filer er oprettet/ændret/slettet + gate passed (vedhæft output/screenshots ved UI)

## Hvad du IKKE må uden at spørge

- Tilføje nye eksterne services (auth provider, mail provider, etc.)
- Ændre database schema uden migration
- Tilføje LLM-kald eller andre eksterne API-calls
- Skrive secrets nogen steder, heller ikke som "TODO: replace"
- Lave breaking changes til API-kontrakt

## Brugerens præferencer (Jan, IT Operations)

- **Git/Vercel:** PR mod `staging` (auto-merge når CI grøn); prod kun via manuel PR `staging` → `main`. Se `docs/release-process.md` og `docs/workboard-agent-prompt.md`.
- Korte konkrete svar — ikke lange forklaringer medmindre der spørges
- Få det til at virke først, optimer bagefter
- Dansk i UI, engelsk i kode
- Visuelt resultat > lange tekstforklaringer
- Stop ved tvivl, fortsæt ikke "for at være hjælpsom"
- Jan kører ikke kode lokalt — alt skal deployes til cloud for at testes
