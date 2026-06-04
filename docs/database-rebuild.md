# Genskab database (Neon)

Brug denne guide når schema mangler kolonner, seeds er korrupte, eller miljø skal nulstilles **uden** at slette produktionsdata uden godkendelse.

## Automatisk (anbefalet)

Fra repo-roden med `DATABASE_URL` sat (fx via Vercel):

```powershell
cd apps/api
npx vercel env run -e production -- python ..\..\scripts\run_neon_setup.py
```

Scriptet:

1. Kører `init.sql` **kun** hvis `tickets`-tabellen mangler
2. Kører alle migrationer i rækkefølge
3. Kører alle seeds (idempotente hvor muligt)
4. Med `--with-alembic`: kører `scripts/alembic_after_sql_setup.py` (stamp + `upgrade head`)

**Lokal / Cloud Agent:** `bash scripts/bootstrap-dev-database.sh` (evt. `--local-postgres`) gør trin 1–4 + opretter `.env` fra eksempler.

Kilde: `scripts/run_neon_setup.py`

## Migrationer (rækkefølge — må ikke ændres uden grund)

| # | Fil |
|---|-----|
| 1 | `apps/api/src/star_itsm_api/sql/migrations/01_auth-migration.sql` |
| 2 | `apps/api/src/star_itsm_api/sql/migrations/02_org-migration.sql` |
| 3 | `apps/api/src/star_itsm_api/sql/migrations/03_ticket-underaarsag-migration.sql` |
| 4 | `apps/api/src/star_itsm_api/sql/migrations/04_gdpr-attachments-migration.sql` |
| 5 | `apps/api/src/star_itsm_api/sql/migrations/05_ticket-activity-timestamps-migration.sql` |
| 6 | `apps/api/src/star_itsm_api/sql/migrations/06_ticket-assignment-fields-migration.sql` |
| 7 | `apps/api/src/star_itsm_api/sql/migrations/07_ticket-tags-emoji-migration.sql` |
| 8 | `apps/api/src/star_itsm_api/sql/migrations/08_ticket-intelligence-migration.sql` |
| … | (comment reactions through security flag — see `run_neon_setup.py`) |
| 15 | `apps/api/src/star_itsm_api/sql/migrations/15_ticket-routing-metadata-migration.sql` |
| 16 | `apps/api/src/star_itsm_api/sql/migrations/16_knowledge-articles-migration.sql` |
| 17 | `apps/api/src/star_itsm_api/sql/migrations/17_must-change-password.sql` |
| 18 | `apps/api/src/star_itsm_api/sql/migrations/18_user-avatar-url.sql` |

`run_neon_setup.py` is the source of truth for the full ordered list.

## Seeds (rækkefølge)

| # | Fil | Indhold |
|---|-----|---------|
| 1 | `docs/seed-mvp.sql` | Kategorier, SLA, routing |
| 2 | `docs/seed-sub-causes.sql` | Underårsager |
| 3 | `docs/seed-sf-ecosystem-reset.sql` | Org, teams, brugere |
| 4 | `docs/seed-group-sample-tickets.sql` | DEMO-sager |
| 5 | `docs/seed-ticket-intelligence.sql` | LLM-metadata på demo |
| 6 | `docs/seed-larrysanders.sql` | Larry (valgfri admin) |

## Verifikation efter kørsel

Scriptet printer:

```
Done. tickets=N, users=M, organizations=K
```

Forventet ca.: **~46 tickets**, **~23 users**, **~12 organizations** (kan variere).

SQL-tjek i Neon:

```sql
SELECT COUNT(*) FROM users WHERE deleted_at IS NULL;
SELECT column_name FROM information_schema.columns
WHERE table_name = 'tickets' AND column_name IN ('tags', 'ease_score', 'semantic_topics');
```

## Fuld nulstilling (destruktiv)

**Kræver eksplicit godkendelse** — ikke kør i prod uden backup.

1. Neon: drop schema `public` eller nyt branch
2. Kør `init.sql` manuelt i SQL Editor
3. Kør `run_neon_setup.py` (springer init over hvis tickets findes — ved frisk DB kører init automatisk)

## Fejl under migration

| Fejl | Handling |
|------|----------|
| `column already exists` | Migration allerede kørt — ofte OK (`IF NOT EXISTS`) |
| `relation does not exist` | Kør `init.sql` først |
| `duplicate key` på seed | Seed er delvist kørt — tjek `ON CONFLICT` i den pågældende fil |
| Foreign key fejl | Kør seeds i rækkefølge ovenfor |

## Kode ↔ kolonne

Ny kolonne kræver **begge**:

1. `apps/api/src/star_itsm_api/sql/migrations/<NN>_<navn>.sql`
2. SQLAlchemy model + Pydantic schema + evt. TypeScript type

Se [data-model.md](./data-model.md).
