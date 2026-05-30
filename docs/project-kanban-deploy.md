# Deploy: Projekt Kanban (uafhængig af STARdesk)

Dette board er **ikke** en del af STARdesk web/API. Det deployes som tredje Vercel-projekt.

## Checklist

### 1. Neon (separat database)

- Opret nyt Neon-projekt: fx `stardesk-project-kanban`
- Kør [`apps/project-kanban/init.sql`](../apps/project-kanban/init.sql)
- Gem connection string — **brug ikke** STARdesk `DATABASE_URL`

### 2. Vercel-projekt

| Felt | Værdi |
|------|--------|
| Root Directory | `apps/project-kanban` |
| Framework | Next.js (auto) |
| Project name | `stardesk-project-kanban` (eller eget valg) |

### 3. Environment variables (Production)

```
PROJECT_KANBAN_DATABASE_URL=postgresql://...
PROJECT_KANBAN_EMAIL=larrysanders@example.dk
PROJECT_KANBAN_PASSWORD=password
PROJECT_KANBAN_SECRET=<min-32-tegn-tilfældig-streng>
```

Brug samme e-mail/adgangskode som STARdesk, hvis det er det du ønsker.

### 4. Fast URL

- Production-URL: `https://stardesk-project-kanban.vercel.app` (fast så længe projektnavnet er uændret)
- STARdesk redeploy (`apps/web`) **påvirker ikke** dette projekt
- Valgfrit: Settings → Domains → tilføj eget domæne

### 5. Verificér

1. Åbn Kanban-URL → log ind
2. Se seed-opgaver fra `Background/Backlog`
3. Træk kort mellem kolonner
4. Deploy STARdesk igen → Kanban skal være uændret

## Lokal udvikling

```bash
cd apps/project-kanban
npm install
npm run dev
```

Port **3001** (STARdesk web kører typisk på 3000).
