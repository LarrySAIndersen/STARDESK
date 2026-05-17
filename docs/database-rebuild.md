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

Kilde: `scripts/run_neon_setup.py`

## Migrationer (rækkefølge — må ikke ændres uden grund)

| # | Fil |
|---|-----|
| 1 | `docs/auth-migration.sql` |
| 2 | `docs/org-migration.sql` |
| 3 | `docs/ticket-underaarsag-migration.sql` |
| 4 | `docs/gdpr-attachments-migration.sql` |
| 5 | `docs/ticket-activity-timestamps-migration.sql` |
| 6 | `docs/ticket-assignment-fields-migration.sql` |
| 7 | `docs/ticket-tags-emoji-migration.sql` |
| 8 | `docs/ticket-intelligence-migration.sql` |

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

1. `docs/<navn>-migration.sql`
2. SQLAlchemy model + Pydantic schema + evt. TypeScript type

Se [data-model.md](./data-model.md).
