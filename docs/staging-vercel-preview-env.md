# Staging på Vercel — Preview-env og hello-world gate

Når `staging` merges, deployer Vercel **Preview** (ikke Production). Login fejler med `Database is not configured`, hvis **`DATABASE_URL`** mangler i Preview-env på API-projektet.

## Staging-URL'er (bekræftet jun. 2026)

| App | Branch alias (stabil) | Neon |
|-----|------------------------|------|
| API | `https://api-git-staging-kjaerby-1628s-projects.vercel.app` | **`test`** |
| Web | `https://web-git-staging-kjaerby-1628s-projects.vercel.app` | — |

Production forbliver `main` → `api-gamma-amber.vercel.app` / `web-seven-neon-…` (Neon **`main`**).

## Verifikation (jun. 2026)

| Check | Status |
|-------|--------|
| `GET …/health` (uden Vercel share) | **401** — Deployment Protection på Preview |
| `GET …/health` (med share/cookie) | OK — `stardesk_env=development` |
| `POST …/auth/login` | **Fejl** — `Database is not configured` |
| Årsag (login) | `DATABASE_URL` ikke sat på Vercel **api** → **Preview** |

Hvis API returnerer **401**: brug Vercel **Share** på deployment (eller slå beskyttelse fra for team-test), og kør:

```powershell
pwsh -File scripts/verify-staging-hello-world.ps1 -VercelShareUrl 'https://api-git-staging-...vercel.app/?_vercel_share=...'
```

Share-link oprettes i Vercel → deployment → Share (udløber efter ~23 timer).

## Fix — Vercel Dashboard (Jan)

### 1. Neon

1. Neon → projekt → gren **`test`** (aldrig `main` til staging/test).
2. Kopiér connection string → skift driver til async:  
   `postgresql+asyncpg://…` (samme host/user/pass som `postgresql://…`).

### 2. API-projekt (`api`)

[Vercel → api → Settings → Environment Variables](https://vercel.com/kjaerby-1628s-projects/api/settings/environment-variables)

Tilføj under **Preview** (evt. *Specific Branches* → `staging`):

| Variabel | Værdi | Note |
|----------|--------|------|
| `DATABASE_URL` | `postgresql+asyncpg://…` (Neon **test**) | **Påkrævet** for login/tickets |
| `STARDESK_ENV` | `test` | Matcher Neon test |
| `APP_ENV` | `development` | |
| `JWT_SECRET` | Stærk test-hemmelighed | ≠ production |
| `FRONTEND_URL` | `https://web-git-staging-kjaerby-1628s-projects.vercel.app` | CORS |
| `PROTOTYPE_BOOTSTRAP_PASSWORD` | `Stardesk2026!` | Demo-login (API) |
| `SLACK_MOCK` | `1` | |
| `GMAIL_MOCK` | `1` | |

Skabelon: [`apps/api/.env.test.example`](../apps/api/.env.test.example)

### 3. Web-projekt (`web`)

[Vercel → web → Settings → Environment Variables](https://vercel.com/kjaerby-1628s-projects/web/settings/environment-variables)

**Preview** (staging):

| Variabel | Værdi |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://api-git-staging-kjaerby-1628s-projects.vercel.app` |
| `NEXT_PUBLIC_STARDESK_ENV` | `test` |
| `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` | `true` |
| `NEXT_PUBLIC_PROTOTYPE_BOOTSTRAP_PASSWORD` | `Stardesk2026!` |
| `VERCEL_PROTECTION_BYPASS` | **API-projektets** bypass-token (ikke web-token) |
| `STARDESK_USE_STAGING_API` | `false` — **kun** hvis BFF skal tvinges til production API trods bypass |

**Vigtigt — bypass aktiverer staging API som standard:**  
`VERCEL_PROTECTION_BYPASS` lader web kalde det beskyttede api Preview. BFF bruger **staging API** på Preview/test når bypass er sat — login falder tilbage til production hvis staging DB mangler. Sæt `STARDESK_USE_STAGING_API=false` kun hvis du bevidst vil tvinge production API (impersonering virker ikke uden staging API).

**Bypass-token:**

1. Vercel → **api** → Settings → Deployment Protection → *Protection Bypass for Automation* → kopiér secret  
2. Vercel → **web** → Environment Variables → Preview → `VERCEL_PROTECTION_BYPASS` = samme secret  
3. Redeploy **web**

**Uden bypass:** BFF bruger production API — login virker med prod-data (Neon **main**), men impersonering kræver staging API.

Skabelon: [`apps/web/.env.test.example`](../apps/web/.env.test.example)

### 4. Redeploy

Efter env-ændring: **Deployments** → seneste `staging` → **Redeploy** (API først, derefter web).

### 5. Database seed (én gang per Neon test-gren)

Staging API bruger Neon **test**. Seed skal findes der (lokalt eller CI):

```bash
bash scripts/sync-neon-env.sh    # DATABASE_URL = Neon test
bash scripts/bootstrap-dev-database.sh
```

## Hello-world mod staging

**Windows:**

```powershell
pwsh -File scripts/verify-staging-hello-world.ps1
```

**Git Bash:**

```bash
export STARDESK_API_URL=https://api-git-staging-kjaerby-1628s-projects.vercel.app
export TEST_USER_PASSWORD=Stardesk2026!
bash scripts/hello-world-gate-api.sh
```

Scriptet fejler med tydelig besked, hvis DB stadig mangler.

## Vercel CLI (alternativ)

```powershell
cd apps\api
vercel link    # team + api
vercel env add DATABASE_URL preview
# Indsæt postgresql+asyncpg://… fra Neon test
vercel env add STARDESK_ENV preview
# test
vercel env add PROTOTYPE_BOOTSTRAP_PASSWORD preview
# Stardesk2026!
```

Gentag for `apps\web` med `NEXT_PUBLIC_*` fra `.env.test.example`.

## Relateret

- [deliverable-gate.md](./deliverable-gate.md) — gate-krav
- [environments.md](./environments.md) — miljøoversigt
- PR #36 merged til `staging` — env-baseret demo-password (S2068)
