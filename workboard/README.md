# Work Board canvas (git mirror) — retired

> **Pensioneret:** Cursor Work Board / web `/workboard` og kanban agent-pipeline bruges ikke længere.

Den tidligere git-spejl-fil `stardesk-workboard.canvas.tsx` (~10k linjer) er **fjernet** for at reducere Sonar-duplikering og repo-støj. Historisk kilde lå i Cursor canvases-mappen.

Canonical live files (hvis canvas stadig findes lokalt i Cursor):

- `~/.cursor/projects/.../canvases/stardesk-workboard.canvas.tsx`

Agenter skal **ikke** synce, opdatere eller bygge mod Work Board medmindre brugeren eksplicit genaktiverer det.

**Backlog til senere-opgaver:** [backlog.md](./backlog.md) — simpel markdown-liste i Git (erstatter ikke PR-flow).

API-endpoints under `/api/v1/workboard/` og Alembic-tabellen `workboard_tasks` findes stadig i `apps/api` til evt. manuel drift — ikke til agent-workflow.
