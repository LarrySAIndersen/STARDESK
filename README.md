# star-itsm-cloud

Cloud-prototype af STAR ITSM. Ingen Docker, intet lokalt setup.
Alt kører i skyen, du ser det i browseren.

**Udviklere:** [CONTRIBUTING.md](./CONTRIBUTING.md) (kør web + API lokalt, test, env). Miljøer: [docs/environments.md](./docs/environments.md).

> Søsterprojekt til `star-itsm/` (on-prem K8s-versionen).
> Cloud-versionen er til at validere designet hurtigt;
> on-prem-versionen er målet når MVP er bevist.

## Stack

| Lag | Værktøj | Hvor |
|---|---|---|
| Frontend | Next.js 15 + TypeScript + shadcn/ui | Vercel |
| Backend API | Python 3.12 + FastAPI + SQLAlchemy + Alembic | Railway |
| Database | PostgreSQL 16 (Neon serverless) | Neon |
| Code editor | Cursor (Composer) | Lokalt |
| Repo | GitHub (mono-repo med `apps/web` + `apps/api`) | GitHub |

## Hvad du skal have på plads inden vi koder

**Tre gratis konti:**
1. GitHub - du har sandsynligvis allerede
2. Vercel - log ind med GitHub: https://vercel.com
3. Neon - log ind med GitHub: https://neon.tech
4. Railway - log ind med GitHub: https://railway.app

**Opret én ting hvert sted (10 minutter):**

### GitHub
- Opret et tomt repo: `star-itsm-cloud` (privat eller offentligt - dit valg)
- Klon det lokalt (via Cursor: "Clone repository")

### Neon
- Opret et project: `star-itsm`
- Branch: `main` (default)
- Kopier `DATABASE_URL` connection string - gem den i password manager
- Den ser ud som: `postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/star_itsm?sslmode=require`

### Vercel
- Gør ingenting endnu. Vi forbinder repo'et fra Cursor senere.

### Railway
- Gør ingenting endnu. Vi sætter det op når API'et er klar at deploye.

## Kom i gang

### Trin 1: Læg kickoff-filer i repo'et

Kopier disse filer fra denne mappe ind i dit clone'ede repo:

```
star-itsm-cloud/
├── README.md
├── ARCHITECTURE.md
├── CLAUDE.md
├── .gitignore
├── .env.example
├── init.sql
└── docs/
    └── first-prompts.md   ← prompts til Cursor
```

Commit + push.

### Trin 2: Kør init.sql mod Neon

I Neon dashboard → SQL Editor → indsæt indholdet af `init.sql` → kør.

Du har nu en tom database med fuldt schema (13 tabeller, seed data).

### Trin 3: Sæt Cursor op

1. Åbn projektet i Cursor
2. Settings → Rules for AI → peg på `CLAUDE.md`
3. Tilføj `.env.local` (kopi af `.env.example`) - udfyld `DATABASE_URL` fra Neon

### Trin 4: Lad Cursor scaffolde apps

Åbn `docs/first-prompts.md` - der ligger de første 3 prompts klar.

Kopier prompt #1 ind i Cursor Composer. Vent. Review. Accept.
Så prompt #2. Så prompt #3.

Efter prompt #1 har du `apps/web` (Next.js på Vercel).
Efter prompt #2 har du `apps/api` (FastAPI på Railway).
Efter prompt #3 er de forbundet og du kan se en tom ticket-liste i browseren.

### Trin 5: Deploy

**Frontend til Vercel:**
1. Gå til vercel.com → New Project → importer dit GitHub repo
2. Root directory: `apps/web`
3. Environment variables: `NEXT_PUBLIC_API_URL` = (Railway URL fra trin under)
4. Deploy

**Backend til Railway:**
1. Gå til railway.app → New Project → Deploy from GitHub
2. Vælg dit repo, root: `apps/api`
3. Environment variables: `DATABASE_URL` (fra Neon)
4. Deploy
5. Kopier den genererede URL og sæt den ind som `NEXT_PUBLIC_API_URL` i Vercel
6. Redeploy Vercel

Nu har du en kørende app på en `https://star-itsm-cloud.vercel.app`-URL.

## Hvad du IKKE skal gøre

- Ikke installere Python, Node.js, eller PostgreSQL lokalt - alt sker i Cursor + cloud
- Ikke køre `docker` overhovedet
- Ikke skrive kode manuelt - lad Cursor om det, du reviewer og accepterer

## Roadmap (samme som on-prem-versionen)

1. **Scaffold + tomme endpoints** ← prompts #1-3
2. **CRUD på tickets** (opret, list, vis, kommentér)
3. **Routing-regler + kategorier**
4. **SLA-engine + mail-eskalering**
5. **Email-to-ticket** (via Resend webhook eller Postmark)
6. **Auth** (Clerk - simplest, eller NextAuth)
7. **Knowledge base + similar-ticket search**
8. **Agentic: LLM klassificerer/foreslår**

## Hvornår skal vi flytte til on-prem?

Når mindst ét af disse er sandt:
- I har valideret at designet virker for STAR's brugere
- Stakeholders (Claus, Nicolai) har sagt go på arkitekturen
- I har behov for SSO via Entra ID i produktion (Vercel + Clerk er fint til prototype men STAR-prod vil have Entra)
- I skal bruge persondata der ikke må ligge i ekstern cloud

Når den dag kommer, er det `star-itsm/` (søsterprojektet) der er målet,
og denne cloud-version kan parkeres som "demo-miljø".

## Vigtige forskelle fra on-prem versionen

| | star-itsm (on-prem) | star-itsm-cloud (denne) |
|---|---|---|
| Backend | FastAPI + worker | FastAPI (worker = Railway cron) |
| DB | Postgres i K8s | Neon serverless |
| Mail | STAR SMTP relay | Resend (gratis tier) |
| Auth | Entra ID via Keycloak | Clerk eller NextAuth |
| Persondata | OK (on-prem) | Brug fake data i prototypen |
| Deploy | Helm + K8s | git push → Vercel/Railway |
