# Designvalg og begrundelser

Kronologisk/logisk oversigt over **hvorfor** prototypen er bygget som den er.
Ved uenighed mellem docs og kode: **koden vinder** — opdater denne fil efter ændringer.

## Platform og stack

| Valg | Begrundelse |
|------|-------------|
| Next.js 15 (App Router) + FastAPI | Hurtig cloud-deploy (Vercel web + Vercel serverless API), delt domænemodel med on-prem |
| Neon PostgreSQL | Serverless, samme SQL som prod |
| SQL-filer i `docs/` frem for kun Alembic i prototype | Jan deployer via script; `run_neon_setup.py` kører kendt rækkefølge |
| Dansk UI, engelsk kode | STAR-konvention (se `CLAUDE.md`) |

## Auth og session

| Valg | Begrundelse |
|------|-------------|
| JWT (HS256, 12 t) | Simpelt for prototype; `JWT_SECRET` påkrævet |
| Login via `POST /api/auth/login` (Next route) | Sætter **HttpOnly** cookie; token ikke læsbart i JS (XSS) |
| Browser-API via `/api/proxy/v1/...` | Proxy læser cookie server-side og kalder backend |
| `USER_COOKIE` ikke HttpOnly | Kun visning i header; autorisation via token |
| bcrypt cost 12 | Standard password hashing |
| 0,4 s delay ved fejl-login | Svækket brute-force (ikke fuld rate-limit i serverless) |

## Organisationer og SF-økosystem

| Valg | Begrundelse |
|------|-------------|
| `sf01`–`sf03` = `admin`, ingen `organization_id` | Ser **alle** sager på dispatch |
| Virksomheds-agenter = `agent` + `organization_id` | Ser kun egen orgs sager på board |
| `can_assign_to_any_team` for admin + virksomheds-agent | Drag-drop til **alle** grupper (SF som hub) |
| Gruppe `SF` uden organisation | Hovedgruppe til videresendelse |
| `larrysanders@example.dk` udeladt fra login-UI | Separat demo-konto; ikke i offentlig liste |

## Dispatch board

| Valg | Begrundelse |
|------|-------------|
| `GET /tickets?board=true` | Fuld org-liste (ikke team-filter) for staff board |
| Drag-drop + dialog (årsag, fejlviseret) | Audit og STAR-proces |
| `text/plain` + custom MIME med ticket UUID | Browser-kompatibilitet ved drag |
| Gruppelister med klikbare sager | Hurtig navigation til detalje |

## Tags, emoji og LLM-metadata

| Valg | Begrundelse |
|------|-------------|
| Max 10 tags, søgning i titel/beskrivelse/tags | Let filtrering uden ekstern søgemotor |
| 10 faste emoji | Konsistent UI; valideret i API |
| `ease_score` / `complexity_score` | **Lethed** og kompleksitet til triage/LLM |
| Ingen LLM-kald i app | Kun data + API til ekstern agent (godkendelse påkrævet for rigtige kald) |
| Heuristik når ikke seed’et | Altid noget at vise i UI |

## Sikkerhed (prototype)

| Valg | Begrundelse |
|------|-------------|
| `APP_ENV=production` → kræv `CRON_SECRET` / `WEBHOOK_SECRET` | Fail-closed; undgå åbne webhooks |
| Security headers (API + Next) | Baseline hardening |
| Upload: 10 MB, allowlist content-types, virus-scan stub | GDPR/vedhæftninger |
| CPR kun i dedikeret felt | Ikke i fritekst (validering i API) |
| `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` | Skjul adgangskoder i hardened prod |
| CI: bandit, npm audit, pytest | Se `.github/workflows/security.yml` |

## Bevidst **ikke** i v1

- Entra ID / Keycloak (kommer on-prem)
- Alembic som eneste migrationskanal (SQL-scripts i prototype)
- ARQ worker (cron-endpoints i stedet)
- Embeddings/RAG i drift (kolonne findes i `init.sql`)

## Filer der implementerer valgene

| Emne | Filer |
|------|-------|
| Adgang | `services/org_access.py` |
| Auth | `core/security.py`, `web/src/app/api/auth/` |
| Proxy | `web/src/app/api/proxy/` |
| Dispatch | `web/src/components/agent-dispatch-board.tsx` |
| Intelligence | `services/ticket_intelligence.py` |
| Seeds | `docs/seed-sf-ecosystem-reset.sql` |
