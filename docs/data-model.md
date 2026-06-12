# Datastruktur (domænemodel)

Sandheden i kode: SQLAlchemy-modeller i `apps/api/src/star_itsm_api/models/`.
Basis-schema: `init.sql`. Cloud-udvidelser: `apps/api/src/star_itsm_api/sql/migrations/*.sql`.

## Entitetsdiagram (oversigt)

```mermaid
erDiagram
    organizations ||--o{ users : has
    organizations ||--o{ teams : has
    users ||--o{ tickets : reports
    teams ||--o{ tickets : assigned_team
    users ||--o{ tickets : assigned_user
    tickets ||--o{ ticket_comments : has
    tickets ||--o{ attachments : has
    tickets ||--o{ ticket_events : has
    categories ||--o{ subcategories : has
    tickets }o--o{ sub_causes : ticket_sub_causes
    teams ||--o{ team_members : has
    users ||--o{ team_members : member
```

## Enum-værdier

### `users.role`

| Værdi | UI (dansk) | Betydning |
|-------|------------|-----------|
| `end_user` | Indmelder | Self-service, egne sager |
| `agent` | Agent | Sagsbehandling |
| `admin` | Administrator | Fuld adgang (SF) |

### `tickets.ticket_type`

`service_request` | `incident` | `problem`

### `tickets.status`

`new` → `assigned` → `in_progress` → `on_hold` → `resolved` → `closed` | `cancelled`

### `tickets.priority`

`critical` | `high` | `medium` | `low`

### `tickets.source`

Hvordan sagen kom ind: `portal` (selvbetjening) | `email` | `api` | `phone` | `chat` | `knowledge` (vidensartikel).

### `tickets.intelligence_source`

`seed` | `heuristic` | `llm` | `manual`

### `attachments.scan_status`

`pending` | `scanning` | `clean` | `infected` | `failed`

## Kerne-tabeller

### `users`

| Kolonne | Type | Note |
|---------|------|------|
| id | UUID | PK |
| email | VARCHAR | UNIQUE, lowercase ved login |
| display_name | VARCHAR | |
| role | VARCHAR | se enum |
| is_active | BOOLEAN | |
| password_hash | VARCHAR | bcrypt (migration) |
| organization_id | UUID | FK → organizations (virksomheds-agent) |
| external_id | VARCHAR | reserveret |
| created_at, updated_at, deleted_at | TIMESTAMPTZ | soft delete |

### `organizations`

| Kolonne | Type |
|---------|------|
| id | UUID |
| name | VARCHAR UNIQUE |
| description | TEXT |
| is_active | BOOLEAN |

### `teams`

| Kolonne | Type | Note |
|---------|------|------|
| id | UUID | |
| name | VARCHAR UNIQUE | fx `SF`, `Jobflow` |
| organization_id | UUID | NULL for SF hovedgruppe |
| escalation_email | VARCHAR | SLA-mail |
| is_active | BOOLEAN | |

### `team_members`

Komposit PK: `(team_id, user_id)`.

### `tickets`

| Kolonne | Type | Note |
|---------|------|------|
| id | UUID | |
| ticket_number | VARCHAR UNIQUE | fx `INC-0001`, `DEMO-0001` |
| title, description | VARCHAR / TEXT | |
| status, priority, ticket_type | VARCHAR | |
| reporter_user_id | UUID | FK users |
| organization_id | UUID | arver ofte fra indmelder/org |
| assigned_team_id, assigned_user_id | UUID | nullable |
| category_id, subcategory_id | UUID | |
| source | VARCHAR | |
| sla_policy_id | UUID | |
| response_due_at, resolution_due_at | TIMESTAMPTZ | |
| first_response_at, assigned_at, in_progress_at, on_hold_at, resolved_at, closed_at, cancelled_at | TIMESTAMPTZ | milepæle |
| gdpr_consent, gdpr_consent_at | BOOL / TIMESTAMPTZ | |
| subject_cpr | VARCHAR(11) | kun hvor tilladt |
| assignment_reason | TEXT | ved tildeling |
| fault_displayed | BOOLEAN | fejlviseret |
| tags | TEXT[] | max 10, normaliseret lowercase |
| emoji | VARCHAR(16) | kurateret liste |
| semantic_topics | TEXT[] | LLM/triage |
| ease_score | SMALLINT 1–5 | lethed (5 = let) |
| complexity_score | SMALLINT 1–5 | kompleksitet |
| llm_summary | TEXT | |
| handling_hints | TEXT[] | |
| intelligence_source, intelligence_updated_at | | |
| is_major | BOOLEAN | stor sag |
| escalation_level | SMALLINT 0–3 | |
| description_embedding | VECTOR(1024) | init.sql, fremtidig RAG |
| created_at, updated_at, deleted_at | TIMESTAMPTZ | |

### `ticket_comments`

| Kolonne | Note |
|---------|------|
| is_internal | agent-only vs. kunde-synlig |
| author_user_id | |

### `attachments`

| Kolonne | Note |
|---------|------|
| storage_key | filsti på disk / upload_dir |
| visible_to_submitter | efter godkendt scan |
| scan_status | se enum |

### `ticket_events`

Audit-log: `event_type` + JSON `payload` (fx `ticket.assigned`, `comment.created`).

### `sub_causes` + `ticket_sub_causes`

Underårsager (mange-til-mange på ticket).

### `categories` / `subcategories`

Dansk visning: `name_da`. Routing og SLA kan pege på kategori.

### `sla_policies` / `sla_assignments` / `routing_rules`

Se `init.sql` — bruges ved oprettelse af sag.

## Indekser (vigtige)

- `tickets`: status, assigned_team, reporter, GIN på tags og semantic_topics
- `users.email` WHERE deleted_at IS NULL
- Trigram på title/description (søgning)

## TypeScript-spejl (frontend)

`apps/web/src/types/ticket.ts`, `user.ts`, `team.ts` — hold synkron med API Pydantic schemas i `apps/api/src/star_itsm_api/schemas/`.

## Workspace landing (arbejdsrum / sitemap)

Per-bruger widget-layout for forsiden (`/`) og sitemap (`/sitemap`). Erstatter/localStorage-sync mod API.

### `user_workspace_layouts`

| Kolonne | Type | Note |
|---------|------|------|
| user_id | UUID | PK, FK → users ON DELETE CASCADE |
| layout | JSONB | `{ personal: WorkspaceWidgetInstance[], team: WorkspaceWidgetInstance[] }` |
| layout_version | INTEGER | Schema-version (default 1) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `layout.personal` / `layout.team` — widget-instans

| Felt | Type | Note |
|------|------|------|
| instance_id | string | Stabil id (fx `personal-dashboard-0`) |
| kind | string | Se widget-katalog nedenfor |
| order | integer | Visningsrækkefølge (0-baseret) |
| span | `full` \| `half` | Kolonnebredde på overblik |
| hidden | boolean | Skjult fra overblik/sitemap |

### Widget-kinds (`kind`)

| Kind | Space | Beskrivelse |
|------|-------|-------------|
| `personal-dashboard` | personal | Driftsdashboard (KPI) |
| `dispatch-queue` | personal | Fordeling af nye sager |
| `personal-notes` | personal | Post-it tavle |
| `personal-kanban` | personal | Min kanban |
| `my-tickets` | personal | Mine sager |
| `team-dashboard` | team | Team-dashboard |
| `team-chat` | team | Teamchat-genvej |
| `team-members` | team | Team online |
| `team-dispatch` | team | Team-kø |

### API

| Metode | Sti | Auth |
|--------|-----|------|
| GET | `/api/v1/workspace/landing` | Staff |
| PUT | `/api/v1/workspace/landing` | Staff |
| POST | `/api/v1/workspace/landing/reset` | Staff |

SQL: `apps/api/src/star_itsm_api/sql/migrations/39_workspace-layout.sql`  
Model: `models/workspace_layout.py`  
Alembic-revision: **afventer godkendelse** (brug SQL-migration + `db_schema_sync` indtil da).
