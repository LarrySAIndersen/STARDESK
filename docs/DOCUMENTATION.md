# STARdesk — dokumentation (genskabelse og fejlsøgning)

Denne mappe beskriver **datastruktur**, **designvalg** og **drift** for cloud-prototypen.
Brug den når noget skal genskabes i Neon, når adgang ikke matcher forventning, eller efter deploy-fejl.

## Hurtig fejlsøgning

| Symptom | Tjek først |
|---------|------------|
| Kan ikke logge ind | [demo-users-and-access.md](./demo-users-and-access.md), `JWT_SECRET`, `/api/auth/login` |
| Ingen testbrugere på login | Vercel: `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` |
| 401 på API | HttpOnly-cookie + [design-decisions.md](./design-decisions.md) § Auth |
| Tom sagliste for agent | Org-filter vs. rolle — [demo-users-and-access.md](./demo-users-and-access.md) |
| Drag-drop gemmer ikke | Browser + `PATCH .../assignment`, se [api-reference.md](./api-reference.md) |
| Cron/webhook 503 | `APP_ENV=production` kræver `CRON_SECRET` / `WEBHOOK_SECRET` |
| Manglende kolonner i DB | Kør [database-rebuild.md](./database-rebuild.md) migrations i rækkefølge |

## Dokumenter

| Fil | Indhold |
|-----|---------|
| [data-model.md](./data-model.md) | Tabeller, felter, enum-værdier, relationer |
| [design-decisions.md](./design-decisions.md) | Arkitektur- og produktvalg (hvorfor sådan) |
| [demo-users-and-access.md](./demo-users-and-access.md) | Testbrugere, grupper, adgangskoder, adgangsregler |
| [api-reference.md](./api-reference.md) | REST-endpoints og vigtige payloads |
| [database-rebuild.md](./database-rebuild.md) | Genskab schema + seed fra bunden |
| [llm-ticket-evaluation.md](./llm-ticket-evaluation.md) | LLM-metadata og API til vurdering |
| [deploy.md](./deploy.md) | Vercel/Railway deploy |
| [frontend-structure.md](./frontend-structure.md) | Next.js ruter og komponenter |
| [performance-testing.md](./performance-testing.md) | Headless load/soak/stress (20 VU) |
| [destructive-testing.md](./destructive-testing.md) | k6 abuse + pytest destructive |

Cursor Agent Skills (explicit invocation): `.cursor/skills/stardesk-performance-load-test/`, `.cursor/skills/stardesk-destructive-testing/`.

## Kode ↔ dokumentation

| Område | Kilde (sandheden i kode) |
|--------|---------------------------|
| DB-model | `apps/api/src/star_itsm_api/models/` |
| API-ruter | `apps/api/src/star_itsm_api/routers/` |
| Adgangslogik | `apps/api/src/star_itsm_api/services/org_access.py` |
| Demo-brugere (UI) | `apps/web/src/lib/demo-users.ts` |
| Demo-brugere (DB) | `docs/seed-sf-ecosystem-reset.sql` |
| Migrationer | `docs/*.sql` + `scripts/run_neon_setup.py` |
| Basis-schema | `init.sql` |

## Produktion (reference)

- Web: https://web-seven-neon-6bvmcoel7n.vercel.app
- API: https://api-gamma-amber.vercel.app
- Standard testadgangskode (undtagen larrysanders): `Stardesk2026!`

Opdater denne fil ved større strukturændringer.
