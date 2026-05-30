# star-itsm-cloud — Arkitektur

> Cloud-prototype af STAR ITSM. Søsterprojekt til on-prem `star-itsm/`.
> Samme domænemodel, anden deployment-strategi.

## Komponenter

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                 │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  apps/web (Next.js 15)                                   │
│  Vercel, automatisk deploy fra GitHub                    │
│  - UI på dansk                                           │
│  - Server Components + Server Actions for simple flows   │
│  - Kalder apps/api for komplekse operationer             │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────┐
│  apps/api (FastAPI)                                      │
│  Vercel serverless (FastAPI service), deploy fra GitHub  │
│  - REST API under /api/v1/*                              │
│  - SQLAlchemy 2.0 async                                  │
│  - Alembic for migrations (CI/manuel — ikke ved cold start) │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │ asyncpg
┌─────────────────────▼───────────────────────────────────┐
│  PostgreSQL 16 (Neon serverless)                         │
│  - Samme schema som on-prem versionen                    │
│  - Auto-suspend efter idle (gratis tier)                 │
└──────────────────────────────────────────────────────────┘
```

## Mappestruktur

```
star-itsm-cloud/
├── apps/
│   ├── web/                  # Next.js (deployed to Vercel)
│   │   ├── src/app/
│   │   ├── src/components/
│   │   ├── package.json
│   │   └── vercel.json
│   └── api/                  # FastAPI (deployed to Vercel serverless)
│       ├── index.py          # Vercel entrypoint
│       ├── src/star_itsm_api/
│       ├── alembic/
│       ├── tests/
│       ├── pyproject.toml
│       ├── vercel.json
│       └── railway.toml      # legacy alternativ (ikke prod)
├── docs/
│   ├── ARCHITECTURE.md       # Denne fil
│   └── first-prompts.md      # Prompts til Cursor
├── init.sql
├── .env.example
├── .gitignore
├── CLAUDE.md
└── README.md
```

**Bevidst valg:** Ingen worker-tjeneste i v1. SLA-monitor køres som
Vercel cron-route (`apps/api/vercel.json`). Email-inbound håndteres
via Resend/Postmark webhook der hitter et endpoint.

**Produktion (Vercel):** web → `star-itsm.sbs` / `web-seven-neon-…vercel.app`;
api → `api-gamma-amber.vercel.app`. Se `docs/environments.md`.

**Alembic:** Kører **ikke** ved API cold start (undgår Vercel timeouts).
Efter push til `main`: GitHub Actions (`security.yml` → `database-migrate`)
eller manuelt via workflow `Database migrate (manual)` / `scripts/run-migrate.py`.

## Domænemodel

**Identisk med on-prem versionen.** Se on-prem `ARCHITECTURE.md` § 2 for
detaljer. Schema-filen `init.sql` her er en kopi.

Kernen er:
- `users`, `teams`, `team_members`
- `categories` + `subcategories` (2-niveau hierarki)
- `tickets` (med `ticket_type` = service_request | incident | problem)
- `ticket_comments`, `attachments`, `ticket_events` (audit)
- `sla_policies`, `sla_assignments`, `routing_rules`
- `problem_incident_links`
- `email_inbound_log`

## API-overflade (samme som on-prem)

Alle endpoints under `/api/v1/`. Identisk med on-prem versionen.

## Forskelle fra on-prem

| Område | On-prem | Cloud |
|---|---|---|
| Backend deploy | K8s + Helm | Vercel serverless (FastAPI) |
| Frontend deploy | K8s container | Vercel (Next.js) |
| DB host | Postgres in K8s | Neon serverless |
| Worker | Separat ARQ-service | Vercel cron |
| Mail out | STAR SMTP relay | Resend |
| Mail in | IMAP poll | Resend Inbound webhook |
| Auth | Entra ID via Keycloak | Clerk (prototype) |
| Secrets | K8s Secrets | Vercel env vars (`DATABASE_URL` på api-projekt) |
| Observability | Grafana + Loki | Vercel logs + Analytics |

## Migration cloud → on-prem (senere)

Når cloud-versionen har bevist konceptet og I vil flytte til on-prem:

1. **Domænemodel og kode**: 95% genbruges direkte (FastAPI er FastAPI)
2. **DB**: pg_dump fra Neon → restore til on-prem Postgres
3. **Auth**: Skift Clerk ud med Entra ID (refaktor af `auth/` modulet)
4. **Mail**: Skift Resend ud med SMTP relay (skift en provider-klasse)
5. **Workers**: Tilføj ARQ-worker service til at erstatte cron-jobs
6. **Deployment**: Helm charts til K8s i stedet for Vercel serverless

## Agentic roadmap

Samme som on-prem. Cloud-versionen er faktisk **lettere** at eksperimentere
med agents på, fordi det er hurtigere at iterere uden K8s deploy-cycle.

Når en agent-feature er stabil i cloud-prototypen, flyttes implementationen
over i on-prem branchen.

## Sikkerhed i prototype-fasen

- **Ingen rigtige persondata.** Brug fiktive navne (`anders.andersen@example.dk`).
- **Auth kan være simpel** i begyndelsen (Clerk magic links eller bare et
  hardcoded admin login) - real Entra ID kommer i on-prem versionen.
- **Secrets aldrig i kode** - kun i Vercel env vars (især `DATABASE_URL` på api-projekt).
- **Database backups** - Neon har point-in-time recovery på betalte tiers.
  Gratis tier: tag pg_dump manuelt hvis du har vigtige eksperimenter at gemme.
