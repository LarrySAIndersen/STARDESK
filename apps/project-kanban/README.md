# STARDESK Projekt Kanban

**Separat Kanban-board** til at holde styr på STARDESK-projektets backlog.  
Deployes som **eget Vercel-projekt** — påvirkes **ikke** når du deployer `apps/web` eller `apps/api`.

## Hurtig start (lokal)

```bash
cd apps/project-kanban
cp .env.example .env.local
# Udfyld PROJECT_KANBAN_DATABASE_URL, PROJECT_KANBAN_EMAIL, PROJECT_KANBAN_PASSWORD, PROJECT_KANBAN_SECRET
npm install
npm run dev
```

Åbn http://localhost:3001

## Database (Neon — separat fra STARdesk)

1. Opret **nyt Neon-projekt** (eller ny database) — brug **ikke** STARdesk `DATABASE_URL`
2. Kør `init.sql` i SQL Editor (opretter kolonner + seed fra `Background/Backlog`)
3. Kopiér connection string til `PROJECT_KANBAN_DATABASE_URL`

## Login

Sæt env vars (samme som du bruger på STARdesk, hvis du vil):

| Variabel | Eksempel |
|----------|----------|
| `PROJECT_KANBAN_EMAIL` | `larrysanders@example.dk` |
| `PROJECT_KANBAN_PASSWORD` | `password` |
| `PROJECT_KANBAN_SECRET` | Lang tilfældig streng (min. 16 tegn) |

## Deploy (Vercel — fast URL)

1. [Vercel](https://vercel.com) → **New Project** → import GitHub repo
2. **Root Directory:** `apps/project-kanban` (vigtigt!)
3. **Project name:** fx `stardesk-project-kanban` (fast URL)
4. Environment variables (Production):
   - `PROJECT_KANBAN_DATABASE_URL`
   - `PROJECT_KANBAN_EMAIL`
   - `PROJECT_KANBAN_PASSWORD`
   - `PROJECT_KANBAN_SECRET`
5. Deploy

Valgfrit: tilknyt **custom domain** (fx `projekt-kanban.ditdomæne.dk`) — URL ændres så aldrig ved STARdesk-deploy.

## Uafhængighed af STARdesk

| | STARdesk | Projekt Kanban |
|---|----------|----------------|
| Vercel-projekt | `apps/web` + `apps/api` | `apps/project-kanban` |
| Database | STARdesk Neon | Egen Neon DB |
| Login | JWT / API | Env-baseret session |
| Deploy | Påvirker kun ITSM | Isoleret |

Se også [docs/project-kanban-deploy.md](../../docs/project-kanban-deploy.md).
