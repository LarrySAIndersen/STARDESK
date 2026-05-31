# Jan-opsætning: kun dev — ikke prod ved et uheld

Kort guide når du **kun bruger Cursor** og **reviewer PR’er på GitHub**. Målet: dagligt arbejde rammer **test/dev**, og **produktion** kun når du selv merger til `main`.

**Fuld proces (board → auto staging → manuel prod):** [release-process.md](./release-process.md)

Se også: [environments.md](./environments.md), [deliverable-gate.md](./deliverable-gate.md), [deploy.md](./deploy.md).

---

## Hvad er hvad?

| Navn | Git-gren | Vercel | Database (Neon) | Hvem bruger det |
|------|----------|--------|-----------------|-----------------|
| **Prod** | `main` | Production (web + api) | gren **`main`** | Live brugere |
| **Dev/test** | `staging` (eller feature-grene) | **Preview** eller `web-test` / `api-test` | gren **`test`** | Dig, agenter, QA |
| **Lokal agent-VM** | — | — | test eller lokal Postgres | Cursor Cloud Agent |

**Prod-URL’er (eksempel):**

- Web: `https://web-seven-neon-6bvmcoel7n.vercel.app`
- API: `https://api-gamma-amber.vercel.app`

Preview-URL’er får du under hver PR på GitHub → **Deployments** / Vercel-kommentar.

---

## Din rutine (3 trin)

```text
1. Cursor     → opgave på gren staging (eller feature) — IKKE main
2. GitHub     → læs PR, tjek deliverable gate, merge til staging (test)
3. Når klar   → separat PR staging → main → du merger → prod deploy
```

Du behøver **ikke** git i terminalen, hvis agenten pusher og opretter PR for dig.

---

## Trin A — GitHub (stop prod-merge)

1. Åbn: **https://github.com/LarrySAIndersen/STARDESK/settings/branches**
2. **Add branch protection rule**
3. Branch name pattern: `main`
4. Slå til:
   - **Require a pull request before merging**
   - (Valgfrit) **Require approvals** — 1, dig selv
5. **Create** / **Save**

**Slå fra:** Auto-merge på åbne PR’er (knap findes på PR-siden — brug den ikke).

### Opret `staging` (én gang)

Hvis `staging` ikke findes:

1. GitHub → repo → branch dropdown → skriv `staging` → **Create branch: staging** fra `main`
2. Fremover: agent-PR’er har **base = `staging`**, ikke `main`

### Hvor ser du PR’er?

**https://github.com/LarrySAIndersen/STARDESK/pulls**

- **Open** = skal du kigge på
- **Closed** + **Merged** = kom ind i mål-grenen

---

## Trin B — Vercel (prod kun fra `main`)

Gør dette for **begge** projekter: **`web`** og **`api`**.

### B1 — Production branch

1. **https://vercel.com** → dit team → projekt **`web`**
2. **Settings** → **Git**
3. **Production Branch** = `main`
4. Gentag for projekt **`api`**

Kun push/merge til `main` giver Production-deploy.

### B2 — Preview til dev (vigtigt)

Uden Preview-env virker dev-deploy ikke ordentligt.

1. Projekt **`api`** → **Settings** → **Environment Variables**
2. Tilføj (eksempler — brug **Preview** scope, ikke Production):

| Variabel | Værdi |
|----------|--------|
| `DATABASE_URL` | Neon **`test`**-gren, `postgresql+asyncpg://…` |
| `FRONTEND_URL` | Din Preview-web-URL (sættes efter første web-deploy) |
| `JWT_SECRET` | Egen test-hemmelighed (ikke prod) |
| `APP_ENV` | `development` |

3. Projekt **`web`** → **Environment Variables** (Preview):

| Variabel | Værdi |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | Preview API-URL (fx `https://api-xxx.vercel.app` fra api Preview) |
| `NEXT_PUBLIC_STARDESK_ENV` | `test` |
| `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` | `true` |

Skabeloner i repo: `apps/api/.env.test.example`, `apps/web/.env.test.example`.

4. **Redeploy** Preview efter env er sat (Deployments → … → Redeploy).

### B3 — (Valgfrit) tydeligere: egne test-projekter

Opret **`web-test`** og **`api-test`** (samme GitHub-repo, root `apps/web` / `apps/api`).  
Production branch kan stadig være `staging` på test-projekterne — så `main` kun rører de rigtige prod-projekter.  
Se [environments.md](./environments.md).

---

## Trin C — Cursor (instruktion til agent)

Kopiér dette ind i **hver** Cloud Agent-opgave:

```text
Arbejd på gren staging (eller feature-gren fra staging).
Opret KUN draft PR med base staging — ALDRIG main.
Merge ikke. Jeg merger selv på GitHub.
Brug Neon test — ikke prod DATABASE_URL.
Før done: bash scripts/run-deliverable-gate.sh (og --full ved UI).
```

### PR du godkender

| Felt | Dev | Prod |
|------|-----|------|
| **base** | `staging` | `main` |
| **merge** | Når test ser OK ud | Kun release |

---

## Neon — aldrig prod-DB i dev

1. **https://console.neon.tech** → projekt → **Branches**
2. **`test`** — connection string til Preview / agent secrets
3. **`main`** — kun Vercel **Production** på `api`

Agents: `bash scripts/sync-neon-env.sh` (kræver `DATABASE_URL` secret med **test**).

---

## GitHub Actions (ved push til `main`)

Ved merge til `main` kan CI køre migration på `DATABASE_URL` secret (typisk prod).  
Det er **meningen** kun når du release — ikke ved staging-arbejde.

---

## Tjekliste før du merger til `main` (prod)

- [ ] Testet på **Preview** eller test-URL — ikke kun agent-chat
- [ ] Deliverable gate passed (output i PR)
- [ ] Det er **bevidst release**, ikke “gem lige koden”
- [ ] Jan / drift informeret hvis brugere påvirkes

---

## Fejl du vil undgå

| Fejl | Konsekvens |
|------|------------|
| Merge PR til `main` for tidligt | Prod deploy + prod DB-migration |
| Preview uden env | “Virker ikke” på dev-URL |
| Agent med prod `DATABASE_URL` | Risiko for prod-data |
| Auto-merge på GitHub | Prod uden at du klikker |

---

## Hjælp i repo

| Dokument | Indhold |
|----------|---------|
| [deliverable-gate.md](./deliverable-gate.md) | Obligatorisk hello-world før “færdig” |
| [environments.md](./environments.md) | Fuld miljømatrix |
| [AGENTS.md](../AGENTS.md) | Cursor Cloud / agenter |

**PR-oversigt:** https://github.com/LarrySAIndersen/STARDESK/pulls
