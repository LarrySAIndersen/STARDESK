# STARDESK kodepraksis-50 — eksekveringsplan

> Auto-genereret fra `scripts/kodepraksis-agent/kodepraksis-plan.mjs`.
> Kør `npm run kodepraksis:export-plan` efter plan-ændringer.
> Tick-for-tick: `npm run kodepraksis:tick` · Queue: `reports/kodepraksis-agent-queue.json`

## Fallback-regel (alle punkter)

1. **Primær** — fuld scope i punktet.
2. **Partial** — mindre scope (se kolonne).
3. **Defer** — parkér i queue (`deferred`), fortsæt næste punkt.
4. **Skip** — `wontfix` med note når irrelevant.

Afslut hver tick: deliverable gate + PR mod `staging` + `npm run kodepraksis:result`.

## Kø-rækkefølge

#39 → #40 → #43 → #44 → #50 → #3 → #41 → #42 → #1 → #2 → #7 → #8 → #10 → #4 → #9 → #5 → #6 → #11 → #12 → #18 → #13 → #14 → #17 → #19 → #20 → #21 → #29 → #22 → #23 → #24 → #25 → #30 → #26 → #27 → #28 → #15 → #16 → #31 → #32 → #33 → #34 → #35 → #36 → #37 → #38 → #45 → #46 → #47 → #48 → #49

## Plan-tabel

| # | Kategori | Titel | Primær | Partial fallback | Defer når |
|---|----------|-------|--------|------------------|-----------|
| 39 | LINT | Expand Ruff: C90, D, S, SIM, PTH, RET, ARG | pyproject.toml select += C90,D,S,SIM,PTH,RET,ARG; fix violations in batches | Enable SIM+RET+ARG only (no D/S first) | C901 blocks merge |
| 40 | LINT | pre-commit: ruff, eslint, tsc --noEmit | .pre-commit-config.yaml + docs in CONTRIBUTING | ruff only hook; CI runs eslint | Devs skip hooks |
| 43 | LINT | Pin Python deps (== / uv.lock truth) | requirements.txt from uv export --frozen; doc use uv sync | Pin prod deps only in requirements.txt | Vercel uses requirements |
| 44 | LINT | Dependabot or Renovate | .github/dependabot.yml for npm + pip/uv | npm only | Noise too high |
| 50 | STYLE | make check — full local quality | Makefile target check → ruff + eslint + tsc + pytest (+ vitest when #31) | make check-api and check-web split | Make not cross-platform |
| 3 | TYPING | Ruff ANN, TCH, PYI typing rules | Extend pyproject select with ANN,TCH,PYI; fix per package | ANN on routers/ only | Stub churn blocks sprint |
| 41 | LINT | CI lint+test on all PRs | Audit .github/workflows; add missing ruff/eslint job | Lint only on apps/api paths changed | Already green |
| 42 | LINT | eslint react-hooks exhaustive-deps | eslint.config: react-hooks/exhaustive-deps error | warn first sprint then error | Lint blocks release |
| 1 | TYPING | Router return type annotations (144 endpoints) | Add return types + AsyncSession on all router handlers; start tickets.py + auth.py | Top 20 highest-traffic endpoints only | CI red after 2 fix attempts |
| 2 | TYPING | Pydantic response_model on all endpoints | Add response_model to every router decorator; one router file per PR | Staff-facing routers first (tickets, kanban, reports) | Requires service return type refactor first |
| 7 | TYPING | Annotated Depends aliases (CurrentUser, DbSession, …) | deps.py aliases; migrate tickets.py + top routers | Staff deps only (require_staff, CurrentUser) | Migration too noisy |
| 8 | TYPING | Replace dict/list returns in services with Pydantic/TypedDict | Grep services returning dict; fix top 10 call sites | Ticket + dashboard services only | Schema unstable |
| 10 | TYPING | pyright/mypy strict baseline (worst 50) | Add pyright to dev group; baseline file; fix 50 errors | strict on services/ only | Blocks sprint |
| 4 | TYPING | py.typed marker package | Add star_itsm_api/py.typed empty marker | Marker only, no strict downstream yet | No external Python consumers |
| 9 | TYPING | Verify generics on optional_db_read for pyright | Add pyrightconfig; fix db_resilience typing errors only | Document typing in docstring only | No pyright in dev deps |
| 5 | TYPING | Frontend Zod validation for API responses | Zod parse in api.ts for tickets, auth, kanban first | Critical paths: login + ticket detail only | OpenAPI codegen scheduled (#6) |
| 6 | TYPING | Shared API types (OpenAPI codegen or package) | Script: openapi-typescript from /openapi.json → apps/web/src/types/api.gen.ts | Codegen tickets + auth namespaces only | Missing response_model |
| 11 | DRY | Extract 72 permission checks to require_staff deps | require_staff + require_agent in deps; codemod routers | tickets.py + kanban.py only (bulk of checks) | PR too large |
| 12 | DRY | ticket_repository.py central get_ticket | repositories/ticket_repository.py + replace duplicates | Replace 5 duplicates in tickets.py first | Soft-delete edge cases |
| 18 | DRY | HTTP error helpers: not_found, forbidden, bad_request | errors.py helpers; replace HTTPException literals in 3 routers | forbidden + not_found only | Large string detail churn |
| 13 | DRY | Shared query builders: pagination, sort, org scope | query_helpers.py; migrate list_tickets + list_users | apply_pagination only | Risky merge |
| 14 | DRY | Shared Pydantic base schemas (timestamps, audit, pagination) | schemas/base.py with TimestampedMixin, Page[T] | Pagination response only | Migration cost |
| 17 | DRY | Versioned idempotent seeds/ module | seeds/ with manifest; wire bootstrap script | Document seed order only | Neon branch reset rare |
| 19 | DRY | Unified mail/notification service module | Consolidate mail send paths into notifications/service | Resend path only | Risky prod mail |
| 20 | DRY | Shared DataTable component for list views | components/data-table.tsx; migrate tickets list first | Column defs only shared hook | Design review needed |
| 21 | SRP | Split tickets.py into 6 domain routers | routers/tickets/{crud,comments,attachments,sla,import,admin}.py + include_router | Extract comments + attachments first (2 files) | Merge conflicts |
| 29 | SRP | Enforce max 50 lines / 400 lines per file (Ruff C901, PLR0915) | Add per-file ignores for legacy; ratchet new code | Warn-only in CI comment | Team rejects PLR0915 |
| 22 | SRP | Split import_tickets_admin (203 lines) | parse → validate → insert → post_process functions | Extract validate+insert only | Blocked by import bugs |
| 23 | SRP | Split list_tickets (186 lines) | parse_filters, build_query, execute, serialize | extract build_query only | Duplicate abstraction |
| 24 | SRP | Split build_dashboard (181 lines) | Widget functions per metric group | One widget extracted as pattern | Perf emergency |
| 25 | SRP | Split sync_gmail_inbox (143 lines) | fetch → parse → create_ticket → update_state | Extract fetch+parse only | No gmail tests |
| 30 | SRP | Move 22 inline text() SQL to queries/ or ORM | Audit text(); convert 5 per PR to SQLAlchemy | Document allowed raw SQL cases | Risky reports |
| 26 | SRP | Split create-ticket-form.tsx (787 lines) | form hook + field components + submit module | Extract TicketFormFields.tsx only | No safety net |
| 27 | SRP | Split kanban-board-view.tsx (657 lines) | board / column / card / dnd handlers | Extract KanbanCard only | Playwright flaky |
| 28 | SRP | Split sf-chat-agent-console.tsx (495 lines) | chat-window, message-list, input, actions | Extract message-list only | Low traffic feature |
| 15 | DRY | Frontend hooks: useTicketForm, useTicketList, useKanbanBoard | Extract from create-ticket-form + kanban-board-view | useTicketForm only | No test coverage (#31) |
| 16 | DRY | Frontend api/* modules per domain | api/tickets.ts, api/kanban.ts; move inline fetch | tickets.ts only | Large diff |
| 31 | TEST | Frontend test suite start (3 critical components) | Vitest + RTL for create-ticket-form, kanban, service-desk-view | One component smoke test | RTL setup blocked |
| 32 | TEST | API integration tests (API→DB→response) | tests/integration/ with httpx ASGI + Neon test DB | auth + tickets happy path only | No DATABASE_URL |
| 33 | TEST | Contract tests: responses match Pydantic schemas | schemathesis or custom assert response validates model | 5 critical endpoints | Schema drift |
| 34 | TEST | Shared test fixtures (ticket, user, team, org) | conftest factories; dedupe setup | ticket + user factories only | Huge conftest diff |
| 35 | TEST | Snapshot tests for ticket-detail API | pytest-snapshot on ticket detail JSON (redact ids) | Inline assert key fields only | Frequent breaks |
| 36 | TEST | Expand e2e to 5 critical user flows | Playwright: login, list, create ticket, kanban move, portal | Add 2 flows this sprint | CI time budget |
| 37 | TEST | Performance regression tests on list endpoints | pytest mark perf; assert p95 < 2s on tickets list | Document threshold; manual perf agent | Neon cold start noise |
| 38 | TEST | Permission boundary tests (end_user vs agent) | Parametrize role × endpoint matrix for 403 | Top 10 agent endpoints | Duplicate setup |
| 45 | DOC | Docstrings on all router functions | D103/D104 with template; one router per PR | Public staff API only | D rule too strict |
| 46 | DOC | OpenAPI quality from schemas + docstrings | tags, descriptions, examples on top 20 endpoints | Export openapi.json to docs/ | Empty paths |
| 47 | DOC | CHANGELOG.md Keep a Changelog | Add CHANGELOG.md + link from README | Unreleased section only | Jan owns releases |
| 48 | DOC | ADRs for HS256, Vercel, Neon, no eager-load | docs/adr/0001-0004.md from template | 2 ADRs this sprint | ADR ceremony heavy |
| 49 | STYLE | Standard error JSON {detail, code, field} | RFC7807 handler + migrate HTTPException to ProblemDetails | New endpoints only; legacy string detail | Web parses string only |

---

Se også [STARDESK-kodepraksis-50.md](./STARDESK-kodepraksis-50.md) for scorecard og rationale.
