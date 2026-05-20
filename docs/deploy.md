# Deploy STARdesk (cloud prototype)

> Fuld dokumentation til genskabelse og fejlsøgning: [DOCUMENTATION.md](./DOCUMENTATION.md)  
> **Test vs. prod vs. prod-klon:** [environments.md](./environments.md) — Neon-grene, Vercel Preview, duplikerede projekter.

Deploy **backend først**, derefter frontend. Frontend skal kende backend-URL.

## Hurtig checklist (15 min)

### Vercel (anbefalet — begge apps)

1. [Neon](https://neon.tech) → project → SQL Editor → kør `init.sql` + `docs/test-data.sql`
2. [Vercel](https://vercel.com) → deploy **`apps/api`** (FastAPI) med `DATABASE_URL` (`postgresql+asyncpg://…`)
3. Vercel → deploy **`apps/web`** med `NEXT_PUBLIC_API_URL` = API-URL
4. API: sæt `FRONTEND_URL` til web-URL (komma-separeret med localhost er OK)

**Live (eksempel):**

- Frontend: https://web-seven-neon-6bvmcoel7n.vercel.app
- API: https://api-gamma-amber.vercel.app

### Railway (alternativ til API)

1. [Neon](https://neon.tech) → nyt project → SQL Editor → kør hele `init.sql`
2. Kopiér connection string → skift `postgresql://` til `postgresql+asyncpg://`
3. [Railway](https://railway.app) → Deploy GitHub `STARDESK` → root **`apps/api`**
4. Railway variables: `DATABASE_URL`, `FRONTEND_URL` (midlertidigt `http://localhost:3000`)
5. Railway → **Generate domain** → kopiér URL
6. [Vercel](https://vercel.com) → Import `STARDESK` → root **`apps/web`**
7. Vercel variable: `NEXT_PUBLIC_API_URL` = Railway-URL
8. Railway: opdater `FRONTEND_URL` til Vercel-URL (komma-separeret med localhost er OK)
9. Neon SQL Editor → kør `docs/test-data.sql` → åbn Vercel-URL

`FRONTEND_URL` kan være flere origins: `https://dit-projekt.vercel.app,http://localhost:3000`

## Forudsætninger

1. `init.sql` er kørt i [Neon](https://neon.tech) SQL Editor.
2. Repo er pushet til GitHub (`LarrySAIndersen/STARDESK`).
3. Du har konti på [Railway](https://railway.app) og [Vercel](https://vercel.com).

---

## 1. Backend → Railway

1. Railway → **New Project** → **Deploy from GitHub repo** → vælg `STARDESK`.
2. **Root directory:** `apps/api`
3. **Environment variables:**

   | Variable | Værdi |
   |----------|--------|
   | `DATABASE_URL` | Neon connection string med `postgresql+asyncpg://` (ikke `postgresql://`) |
   | `FRONTEND_URL` | Midlertidigt `http://localhost:3000` — opdater til Vercel-URL efter trin 2 |

4. Deploy og vent til servicen er **Active**.
5. Kopiér den offentlige URL (fx `https://stardesk-api-production.up.railway.app`).
6. Test: `GET <railway-url>/health` → `{"status":"ok"}`.

---

## 2. Frontend → Vercel

1. Vercel → **Add New** → **Project** → import `STARDESK` fra GitHub.
2. **Root Directory:** `apps/web`
3. **Environment variables:**

   | Variable | Værdi |
   |----------|--------|
   | `NEXT_PUBLIC_API_URL` | Railway-URL fra trin 1 (uden trailing slash) |

4. **Deploy**.
5. Kopiér Vercel-URL (fx `https://stardesk.vercel.app`).

---

## 3. Afslut CORS-kæden

1. Railway → `apps/api` service → **Variables** → sæt `FRONTEND_URL` til din Vercel-URL.
2. Redeploy API (eller vent på auto-redeploy).
3. Vercel → **Redeploy** frontend hvis du ændrede env vars.

---

## 4. Verificer end-to-end

1. I Neon SQL Editor: kør `docs/test-data.sql`.
2. Åbn Vercel-URL i browseren — du bør se én sag i tabellen.
3. Uden test-data: teksten **Ingen sager endnu**.

---

## Miljøvariabler (reference)

### `apps/api` (Railway)

- `DATABASE_URL` — påkrævet i prod for rigtige data
- `FRONTEND_URL` — CORS allowlist
- `RESEND_API_KEY`, `MAIL_FROM`, `JWT_SECRET` — senere prompts

### `apps/web` (Vercel)

- `NEXT_PUBLIC_API_URL` — Railway API base URL

---

## Fejlsøgning

| Symptom | Tjek |
|---------|------|
| Vercel build: *Couldn't find any `pages` or `app` directory* / *No Next.js version detected* | **Root Directory** skal være `apps/web` (ikke repo-roden). Projekt **api** skal have `apps/api`. Settings → Build and Deployment → Root Directory. `apps/web/vercel.json` og `apps/api/vercel.json` læses kun når root directory matcher. |
| Frontend: API-fejl | `NEXT_PUBLIC_API_URL` peger på Railway; API `/health` svarer |
| Tom liste trods test-SQL | `DATABASE_URL` bruger `+asyncpg`; samme Neon DB som `init.sql` |
| CORS-fejl i browser | `FRONTEND_URL` matcher præcis Vercel-URL (https, ingen slash til sidst) |
| API logger DATABASE_URL warning | Sæt variablen i Railway og redeploy |
