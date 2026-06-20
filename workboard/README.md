# Work Board canvas (git mirror) — retired

> **Pensioneret:** Cursor Work Board / web `/workboard` og kanban agent-pipeline bruges ikke længere.

Den tidligere git-spejl-fil `stardesk-workboard.canvas.tsx` (~10k linjer) er **fjernet** for at reducere Sonar-duplikering og repo-støj. Historisk kilde lå i Cursor canvases-mappen.

Canonical live files (hvis canvas stadig findes lokalt i Cursor):

- `~/.cursor/projects/.../canvases/stardesk-workboard.canvas.tsx`

Agenter skal **ikke** synce, opdatere eller bygge mod Work Board medmindre brugeren eksplicit genaktiverer det.

API-endpoints under `/api/v1/workboard/` og Alembic-tabellen `workboard_tasks` findes stadig i `apps/api` til evt. manuel drift — ikke til agent-workflow.

## Produkt-backlog (git)

Planlægningsnoter og fremtidige features — **ikke** Work Board canvas:

| Emne | Fil |
|------|-----|
| Feature flags og A/B-test | [backlog/feature-flags-ab-testing.md](./backlog/feature-flags-ab-testing.md) |
| Sagsarkiv, revision, migration før prod | [sagsarkiv-produktion.md](./sagsarkiv-produktion.md) |
| Dev, gate, Sonar, bash | [huskeliste.md](./huskeliste.md) |

Separat Kanban-board (egen DB): `apps/project-kanban/`.
