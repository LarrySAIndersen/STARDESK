# Deploy STARdesk (cloud prototype)

> Fuld dokumentation til genskabelse og fejlsøgning: [DOCUMENTATION.md](./DOCUMENTATION.md)  
> **Test vs. prod vs. prod-klon:** [environments.md](./environments.md) — Neon-grene, Vercel Preview, duplikerede projekter.

Deploy **backend først**, derefter frontend. Frontend skal kende backend-URL.

## Stack (produktion)

| Komponent | Platform | Root directory | Eksempel-URL |
|-----------|----------|----------------|--------------|
| Frontend | Vercel | `apps/web` | https://web-seven-neon-6bvmcoel7n.vercel.app |
| API | Vercel (separat projekt) | `apps/api` | https://api-gamma-amber.vercel.app |
| Database | Neon PostgreSQL 16 | — | `DATABASE_URL` i Vercel env (api-projekt) |

Push til `main` triggerer auto-deploy på begge Vercel-projekter. Preview-deployments på pull requests.

## Database-migrationer (Alembic)

**Vigtigt:** API kører **ikke** Alembic ved cold start (undgår Vercel timeouts). Migrationer køres separat.

### Automatisk (CI)

Ved push til `main` kører GitHub Actions job **`database-migrate`** i `security.yml` → `alembic upgrade head` efter API-tests.

**Én gang i GitHub:** Settings → Secrets and variables → Actions → `DATABASE_URL` = samme Neon-streng som produktion (`postgresql+asyncpg://…`).

### Manuel kørsel

| Metode | Kommando |
|--------|----------|
| GitHub Actions | Actions → **Database migrate (manual)** → Run workflow |
| Lokal med Vercel env | `cd apps/api && npx vercel env pull .env.local && python ../../scripts/run-migrate.py` |
| Lokal med `DATABASE_URL` | `bash scripts/bootstrap-dev-database.sh` eller `scripts/migrate-db.sh` efter SQL-setup |
| Neon SQL Editor | Kun til engangs-SQL i `docs/*.sql` — Alembic-revisioner skal køres via Alembic |

### Vigtige revisioner

| Revision | Indhold | Påkrævet for |
|----------|---------|--------------|
| `20260530_ticket_stakeholders` | Tabeller `ticket_stakeholders` og `entity_relationships` | Sag #54 — interessenter og relationsgraf på tickets |
| `20260530_workboard_tasks` | Tabel `workboard_tasks` | Work Board DB-persistens ([workboard-persistence.md](./workboard-persistence.md)) |

Kør `alembic upgrade head` for at anvende alle pending revisioner. Tjek status: `cd apps/api && alembic current`.

## Hurtig checklist (15 min)

1. [Neon](https://neon.tech) → project → SQL Editor → kør `init.sql` (+ evt. `docs/test-data.sql`)
2. [Vercel](https://vercel.com) → deploy **`apps/api`** med `DATABASE_URL` (`postgresql+asyncpg://…`)
3. Kør migrationer (CI, manuel workflow eller `scripts/run-migrate.py`)
4. Vercel → deploy **`apps/web`** med `NEXT_PUBLIC_API_URL` = API-URL (uden trailing slash)
5. API: sæt `FRONTEND_URL` til web-URL (komma-separeret med localhost er OK)
6. Test: `GET <api-url>/health` → `{"status":"ok"}`

**Live (reference):**

- Frontend: https://web-seven-neon-6bvmcoel7n.vercel.app
- API: https://api-gamma-amber.vercel.app

`FRONTEND_URL` kan være flere origins: `https://dit-projekt.vercel.app,http://localhost:3000`

## Forudsætninger

1. `init.sql` er kørt i [Neon](https://neon.tech) SQL Editor.
2. Repo er pushet til GitHub.
3. Du har konti på [Neon](https://neon.tech) og [Vercel](https://vercel.com).

---

## 1. Backend → Vercel

1. Vercel → **Add New** → **Project** → import `STARDESK` fra GitHub.
2. **Root Directory:** `apps/api`
3. **Environment variables:**

   | Variable | Værdi |
   |----------|--------|
   | `DATABASE_URL` | Neon connection string med `postgresql+asyncpg://` (ikke `postgresql://`) |
   | `FRONTEND_URL` | Midlertidigt `http://localhost:3000` — opdater til Vercel web-URL efter trin 2 |

4. **Deploy** og vent til build er grøn.
5. Kopiér deployment-URL (fx `https://api-gamma-amber.vercel.app`).
6. Kør Alembic-migrationer (se ovenfor).
7. Test: `GET <api-url>/health` → `{"status":"ok"}`.

---

## 2. Frontend → Vercel

1. Vercel → **Add New** → **Project** → import `STARDESK` fra GitHub (separat projekt fra API).
2. **Root Directory:** `apps/web`
3. **Environment variables:**

   | Variable | Værdi |
   |----------|--------|
   | `NEXT_PUBLIC_API_URL` | API-URL fra trin 1 (uden trailing slash) |

4. **Deploy**.
5. Kopiér Vercel-URL (fx `https://star-itsm-cloud.vercel.app`).

---

## 3. Afslut CORS-kæden

1. Vercel → api-projekt → **Settings** → **Environment Variables** → sæt `FRONTEND_URL` til din web-URL.
2. Redeploy API (eller vent på auto-redeploy efter env-ændring).
3. Vercel → **Redeploy** frontend hvis du ændrede env vars.

---

## 4. Verificer end-to-end

1. I Neon SQL Editor: kør `docs/test-data.sql`.
2. Åbn Vercel web-URL i browseren — du bør se én sag i tabellen.
3. Uden test-data: teksten **Ingen sager endnu**.

---

## Miljøvariabler (reference)

### `apps/api` (Vercel)

- `DATABASE_URL` — påkrævet i prod for rigtige data (`postgresql+asyncpg://…`)
- `FRONTEND_URL` — CORS allowlist
- `RESEND_API_KEY`, `MAIL_FROM`, `JWT_SECRET` — mail og auth
- `CRON_SECRET` — Vercel cron (`/api/v1/cron/sla-check`)
- `BLOB_READ_WRITE_TOKEN` — **required** for ticket image/file attachments on Vercel (local disk is ephemeral). Create a Blob store in Vercel → connect to the **api** project; token is auto-injected. Hobby plan includes free Blob usage within limits.

### `apps/web` (Vercel)

- `NEXT_PUBLIC_API_URL` — Vercel API base URL

---

## Fejlsøgning

| Symptom | Tjek |
|---------|------|
| Vercel build: *Couldn't find any `pages` or `app` directory* / *No Next.js version detected* | **Root Directory** skal være `apps/web` (ikke repo-roden). API-projekt skal have `apps/api`. Settings → Build and Deployment → Root Directory. `apps/web/vercel.json` og `apps/api/vercel.json` læses kun når root directory matcher. |
| Frontend: API-fejl | `NEXT_PUBLIC_API_URL` peger på Vercel API; `GET /health` svarer |
| Tom liste trods test-SQL | `DATABASE_URL` bruger `+asyncpg`; samme Neon DB som `init.sql` |
| CORS-fejl i browser | `FRONTEND_URL` matcher præcis web-URL (https, ingen slash til sidst) |
| API logger DATABASE_URL warning | Sæt variablen i Vercel api-projekt og redeploy |
| Interessenter/relationsgraf virker ikke | Kør `alembic upgrade head` — revision `20260530_ticket_stakeholders` skal være applied |
| Work Board sync fejler | Revision `20260530_workboard_tasks` + korrekt `STARDESK_API_URL` ([workboard-persistence.md](./workboard-persistence.md)) |
| Vedhæftede billeder viser `File not found` | Sæt `BLOB_READ_WRITE_TOKEN` på api-projektet; gen-upload filer (ældre uploads på `/tmp` overlever ikke Vercel serverless) |
