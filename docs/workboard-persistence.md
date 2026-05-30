> **Backup version 2 (2026-05-30):** Tagged `v2.0.0` / `workboard-v2` — DB-backed Work Board tasks; canvas JSON is UI cache only.

# Work Board persistence (Neon + API)

STARdesk Work Board tasks live in **PostgreSQL** (`workboard_tasks`). Git + `stardesk-workboard.canvas.data.json` hold **UI state only** (column widths, selection, forms).

## Recover board after canvas data loss

1. Run migration on Neon: `alembic upgrade head` (revision `20260530_workboard_tasks`).
2. Import current JSON (if any tasks remain):

```bash
cd STARDESK
export STARDESK_API_URL=https://your-api.railway.app
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

Cursor canvases **cannot call `fetch()`**. Phase 1: DB + API + import script. Phase 2 options:

- **Sidecar script** (cron / manual): `migrate-workboard-json-to-db.mjs` + export endpoint
- **STARDESK web** `/workboard` page using API directly (recommended long-term)
- **Cursor hook** on canvas save → trigger sync script

Until sync exists, run import after major canvas sessions and treat DB as authoritative for task numbers/content.
