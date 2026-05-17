# Deploy STARdesk (cloud prototype)

Deploy **backend først**, derefter frontend. Frontend skal kende backend-URL.

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
| Frontend: API-fejl | `NEXT_PUBLIC_API_URL` peger på Railway; API `/health` svarer |
| Tom liste trods test-SQL | `DATABASE_URL` bruger `+asyncpg`; samme Neon DB som `init.sql` |
| CORS-fejl i browser | `FRONTEND_URL` matcher præcis Vercel-URL (https, ingen slash til sidst) |
| API logger DATABASE_URL warning | Sæt variablen i Railway og redeploy |
