> **Backup version 2 (2026-05-30):** Tagged `v2.0.0` / `workboard-v2` — DB-backed Work Board tasks; canvas JSON is UI cache only.

# Work Board persistence (Neon + API)

STARdesk Work Board tasks live in **PostgreSQL** (`workboard_tasks`). Git + `stardesk-workboard.canvas.data.json` hold **UI state only** (column widths, selection, forms).

## Database-migrationer

Work Board kræver Alembic-revision **`20260530_workboard_tasks`**. Kør `alembic upgrade head` mod Neon (se [deploy.md](./deploy.md)).

Interessenter på tickets (sag #54) kræver **`20260530_ticket_stakeholders`** (tabeller `ticket_stakeholders` og `entity_relationships`). Samme `alembic upgrade head` anvender begge revisioner i korrekt rækkefølge.

## Recover board after canvas data loss

1. Run migration on Neon: `alembic upgrade head` (revision `20260530_workboard_tasks`).
2. Import current JSON (if any tasks remain):

```bash
cd STARDESK
export STARDESK_API_URL=https://api-gamma-amber.vercel.app
export STARDESK_API_TOKEN=<jwt-from-login>
node scripts/migrate-workboard-json-to-db.mjs
```

3. Export from DB and restore canvas cache:

```bash
curl -H "Authorization: Bearer $STARDESK_API_TOKEN" \
  "$STARDESK_API_URL/api/v1/workboard/tasks/export" > workboard-tasks-export.json
```

Merge `workboard-tasks-export.json` into `stardesk-workboard.canvas.data.json` under `stardesk-tasks-v1` (keep UI keys unchanged).

## API (staff JWT)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/workboard/tasks` | List (`?status=Review`) |
| GET | `/api/v1/workboard/tasks/export` | Full export for recovery |
| GET | `/api/v1/workboard/tasks/{canvasId or uuid}` | One task |
| GET | `/api/v1/workboard/tasks/by-number/{n}` | By task number |
| POST | `/api/v1/workboard/tasks` | Create |
| PATCH | `/api/v1/workboard/tasks/{ref}` | Partial update |
| PUT | `/api/v1/workboard/tasks/{canvasId}` | Full canvas merge |
| POST | `/api/v1/workboard/tasks/bulk-import` | JSON → DB upsert |

## Canvas limitation (phase 2)

Historisk: Cursor canvases **må ikke importere npm** — Canvas SDK fraråder `fetch()`. **Sag #76** tilføjer dog direkte sync fra Work Board canvas via `globalThis.fetch` til `POST /api/v1/workboard/tasks/bulk-import` (samme payload som `migrate-workboard-json-to-db.mjs`).

### Canvas Gem-knap (sag #76)

1. Klik **Database-sync** i toolbaren → indsæt **API URL** (default prod API) og **staff JWT** fra `/api/v1/auth/login`.
2. Klik **Gem** (til højre for Reset kolonnebredder) — eller vent på auto-save hvert **5. minut**.
3. Status **Gemt kl. HH:MM** vises ved knappen; toast ved manuel gem.
4. Token gemmes i `stardesk-workboard.canvas.data.json` — **commit ikke** filen med token.

API CORS tillader `Origin: null`, `vscode-file://`, `vscode-webview://`, `http://localhost:<port>` (Cursor canvas dev-server), og `https://*.cursor.com` / `*.cursor.sh`. **Neon skal have revision `20260530_workboard_tasks`** (`alembic upgrade head`) — ellers returnerer bulk-import **500**. Ved fortsat «Netværksfejl» i canvas (sandbox blokerer `fetch`): `node scripts/migrate-workboard-json-to-db.mjs` med `STARDESK_API_URL` + `STARDESK_API_TOKEN`.

Phase 2 alternativer (uændret):

- **Sidecar script** (cron / manual): `migrate-workboard-json-to-db.mjs` + export endpoint
- **STARDESK web** `/workboard` page using API directly (recommended long-term)
- **Cursor hook** on canvas save → trigger sync script

Treat DB as authoritative for task numbers/content; canvas JSON remains UI cache. Run `migrate-workboard-json-to-db.mjs` after major sessions if canvas sync was unavailable.
