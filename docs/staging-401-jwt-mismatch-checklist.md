# Staging 401 — "Invalid or expired token" (huskeliste)

**Status:** Afventer fix i morgen (jun. 2026).  
**Symptom:** Efter login på staging (`tstar-itsm.sbs`) fejler alle `/api/proxy/v1/*`-kald med 401 og "Invalid or expired token" (notes, kanban, channels, users, staff-notifications).

**Prod (`star-itsm.sbs`) er OK** — `/api/backend-health` viser `upstream: api-gamma-amber`, `stardesk_env: production`.  
**Staging health er OK** — `/api/backend-health` viser `upstream: api-git-staging-…`, `stardesk_env: test`.

---

## Rodårsag (sandsynlig)

Login og proxy rammer **forskellige API'er**:

1. Login fejler mod staging-API → web falder tilbage til **prod-API** → JWT udstedt med prod `JWT_SECRET`.
2. Proxy kalder **staging-API** → staging `JWT_SECRET` kan ikke validere prod-token → **401**.

Staging-koden har eksplicit besked: `STAGING_JWT_MISMATCH_DETAIL` i `apps/web/src/lib/api-backend.ts` (på `staging`-branch).

---

## Domæner (bekræftet)

| Domæne | Miljø | Web `NEXT_PUBLIC_API_URL` (Production/Preview) |
|--------|--------|--------------------------------------------------|
| `star-itsm.sbs` | **Production** | `https://api-gamma-amber.vercel.app` |
| `tstar-itsm.sbs` | **Preview / staging** | `https://api-git-staging-kjaerby-1628s-projects.vercel.app` |

---

## Fix i morgen (rækkefølge)

### 1. API-projekt → Preview (staging)

| Variabel | Skal være |
|----------|-----------|
| `DATABASE_URL` | Neon **`test`**, `postgresql+asyncpg://…` |
| `JWT_SECRET` | Egen test-hemmelighed (≥32 tegn), ≠ prod |
| `PROTOTYPE_BOOTSTRAP_PASSWORD` | `Stardesk2026!` (**ikke** `sk_live_…` eller anden nøgle) |
| `STARDESK_ENV` | `test` |

→ **Redeploy API Preview** efter ændringer.

### 2. Web-projekt → Preview

| Variabel | Skal være |
|----------|-----------|
| `NEXT_PUBLIC_API_URL` | `https://api-git-staging-kjaerby-1628s-projects.vercel.app` |
| `NEXT_PUBLIC_STARDESK_ENV` | `test` |
| `VERCEL_PROTECTION_BYPASS` | Bypass-token fra **api**-projektet (Settings → Deployment Protection → Protection Bypass for Automation) |

Uden `VERCEL_PROTECTION_BYPASS` kan login falde tilbage til prod, mens proxy stadig bruger staging.

→ **Redeploy web Preview**.

### 3. Frisk session

1. Log ud på `tstar-itsm.sbs`
2. Slet cookies for domænet
3. Log ind med `Stardesk2026!`

### 4. Verifikation

- `https://tstar-itsm.sbs/api/backend-health` → `stardesk_env: test`, staging `upstream`
- DevTools Network: `notes`, `kanban`, `users` → **ikke** 401

---

## Diagnose-test (valgfri)

Midlertidigt på **web Preview**: `STARDESK_USE_STAGING_API=false` → redeploy web → log ind.

- Virker det → bekræfter API-mismatch; fjern flag og lav fix 1+2.
- Virker ikke → tjek `JWT_SECRET` på API Preview igen.

---

## Neon

Ikke årsag til denne 401. Krav: API Preview `DATABASE_URL` = Neon **`test`**. Seed kun hvis login fejler med "forkert password" efter ovenstående.

---

## Relateret

- [staging-vercel-preview-env.md](./staging-vercel-preview-env.md)
- [environments.md](./environments.md)
