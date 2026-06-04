# STARDESK — Lever det op til god kodepraksis?

> Vurdering af kodebasen mod industristandard best practices.
> Baseret på automatiseret scan af `github.com/LarrySAIndersen/STARDESK` v2.0.0
> Format: **scorecard** (hvad er godt / hvad mangler) + **50-punkt forbedringsplan**

---

## Scorecard

| Dimension | Score | Vurdering |
|-----------|:-----:|-----------|
| **Projektstruktur** | 9/10 | Monorepo med klar adskillelse. apps/api, apps/web, scripts, docs, deploy — alt har sin plads. |
| **Navngivning** | 9/10 | snake_case i Python, kebab-case i TSX. Konsistent hele vejen igennem. Kun 4 filer med `.v2.tsx`-suffiks bryder mønsteret. |
| **TypeScript strictness** | 9/10 | `strict: true` i tsconfig. Stærkest mulige TS-konfiguration. |
| **Python typing** | 6/10 | 99% typed returns i services (477/481) — **men 0% i routers (0/144)**. Stor kløft. |
| **Linting** | 7/10 | Ruff konfigureret (E, F, I, UP), ESLint med next/core-web-vitals. Men Ruff mangler complexity, security og docstring-regler. |
| **Dokumentation** | 7/10 | README (147 linjer), ARCHITECTURE.md (140), AGENTS.md, CONTRIBUTING.md. Services har 100 docstrings — **routers har 9**. |
| **Error handling** | 7/10 | God `db_resilience.py` med savepoints. Men 32× broad `except Exception`, og ingen central error-handler. |
| **DRY** | 5/10 | 72 gentagne permission-checks i routers. 14× duplikeret ticket-fetch. Ingen delt repository-lag. |
| **Funktionslængde** | 5/10 | 15 funktioner over 50 linjer. Top 3: 203, 186, 181 linjer. Bør være maks 40-50. |
| **SRP (Single Responsibility)** | 4/10 | tickets.py: 1651 linjer, 26 endpoints, 60 imports. God-router med alt i én fil. |
| **Test** | 5/10 | 89 backend test-filer (ok) — **2 frontend test-filer** (kritisk lavt). Ingen integration tests. |
| **Kodehygiejne** | 9/10 | 0 `print()`, 0 TODO/FIXME/HACK, 0 ubrugte imports (Ruff fanger dem). Rent. |
| **Git workflow** | 6/10 | Ingen pre-commit hooks, ingen git hooks overhovedet. Linting enforcement er frivilligt. |
| **Dependency management** | 6/10 | Floor-pinned (`>=`) i stedet for ceiling-pinned. Ingen lock-fil for Python (uv.lock findes men requirements.txt bruges). |
| **Konfiguration** | 8/10 | Pydantic Settings, .env.example filer, env-validation. 7 hardcoded værdier, men ellers godt. |

**Samlet: 7.0 / 10** — Solidt fundament med specifikke huller i typing, DRY, SRP og test.

---

## Det der er GODT (behold det)

Disse ting gør STARDESK bedre end gennemsnittet — de er værd at beskytte:

**1. Ren kode-hygiejne.** Nul print-statements, nul TODO/FIXME/HACK-kommentarer, nul ubrugte imports. Det virker som en lille ting, men det signalerer disciplin. De fleste codebases har 50-200 TODO'er der aldrig bliver fikset.

**2. Services-laget er velskrevet.** 99% typed returns, 100 docstrings, savepoint-baseret fejlhåndtering (`optional_db_read`), klare grænser mellem services. Det er professionelt niveau.

**3. Constants-fil.** `SYSTEM_USER_ID`, `PRIORITY_ORDER`, `TICKET_TYPE_PREFIX` — centraliseret, tydeligt navngivet, let at finde. Mange codebases har magic values spredt ud i koden.

**4. TypeScript strict mode.** `strict: true` i tsconfig fanger hele kategorier af fejl (null-safety, implicit any). Det er den rigtige default.

**5. Arkitekturdokumentation.** README, ARCHITECTURE.md, AGENTS.md, CONTRIBUTING.md, 50+ docs-filer. Langt over gennemsnittet for et projekt af denne størrelse.

**6. Pydantic Settings med env-validation.** Konfiguration er typesikker, valideret ved opstart, og har klare defaults. Fejlkonfiguration opdages ved deploy, ikke ved runtime.

**7. Konsistent navngivning.** snake_case hele vejen i Python, kebab-case i TSX, klare mappenavne. Intet camelCase/PascalCase-rod.

---

## Det der MANGLER — 50 forbedringer

> Samme debate-first workflow som sikkerhed og performance:
> Cursor skal debattere hvert punkt, vurdere relevans, og præsentere plan før implementering.

### TYPING & CONTRACTS (1-10)

**1.** Tilføj return type annotations til alle 144 router-funktioner. Services har 99% — routers har 0%. Det er den største typing-gæld.
```python
# Før
@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: UUID, db = Depends(require_db)):

# Efter
@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: UUID, db: AsyncSession = Depends(require_db)) -> TicketDetailRead:
```

**2.** Tilføj Pydantic `response_model` til alle endpoints. Kun 1 af 129 har det. Det giver automatisk OpenAPI-dokumentation og runtime-validering af responses.

**3.** Aktivér Ruff-regler for typing: `ANN` (annotations), `TCH` (type-checking imports), `PYI` (type stubs).

**4.** Tilføj `py.typed` marker til pakken så downstream-consumers kan bruge typerne.

**5.** Frontend: tilføj strict null checks for API-responses. Brug Zod-schemas til runtime-validering af fetch-responses (Zod er allerede i deps).

**6.** Definér shared types mellem API og frontend (OpenAPI → codegen, eller delt types-pakke).

**7.** Tilføj `Annotated` types for gentagne Depends-patterns: `CurrentUser = Annotated[User, Depends(get_current_user)]`.

**8.** Definér return types for alle service-funktioner der returnerer `dict` eller `list` — brug TypedDict eller Pydantic-modeller.

**9.** Tilføj generics til `optional_db_read` (allerede bruger PEP 695 `[T]` — verificér at mypy/pyright forstår det).

**10.** Kør `pyright` eller `mypy --strict` og fix de værste 50 fejl som baseline.

### DRY & ABSTRAKTION (11-20)

**11.** Extrahér de 72 permission-check-patterns til dekoratorer eller dependencies:
```python
# Før (gentaget 72 gange)
user = await get_current_user(request, db)
if not is_staff(user):
    raise HTTPException(403, detail=INSUFFICIENT_PERMISSIONS)

# Efter
@router.get("/tickets", dependencies=[Depends(require_staff)])
async def list_tickets(...):
```

**12.** Opret `ticket_repository.py` med én central `get_ticket()` der erstatter de 14 duplikerede `select(Ticket).where(...)`.

**13.** Extrahér fælles query-builders: `apply_pagination()`, `apply_sorting()`, `apply_org_scope()`.

**14.** Saml Pydantic-schema-validering i delte base-classes (timestamps, audit-fields, pagination-response).

**15.** Frontend: extrahér `useTicketForm`, `useTicketList`, `useKanbanBoard` hooks fra de store komponenter.

**16.** Frontend: saml API-kald i `api/tickets.ts`, `api/kanban.ts` osv. i stedet for inline fetch i komponenter.

**17.** Saml seed-SQL i én idempotent `seeds/` modul med versionering.

**18.** Extrahér fælles error-responses (`not_found()`, `forbidden()`, `bad_request()`) som hjælpefunktioner.

**19.** Saml mail-templates og notifikationslogik i ét service-modul.

**20.** Frontend: opret en `<DataTable>` komponent der bruges af alle list-views (tickets, users, teams, knowledge articles).

### FUNKTIONSLÆNGDE & SRP (21-30)

**21.** Split `tickets.py` (1651 linjer, 60 imports) i 6 domæne-routers.

**22.** Split `import_tickets_admin` (203 linjer) i: parse → validate → insert → post-process.

**23.** Split `list_tickets` (186 linjer) i: parse_filters → build_query → execute → serialize.

**24.** Split `build_dashboard` (181 linjer) i dedikerede dashboard-widgets med individuelle queries.

**25.** Split `sync_gmail_inbox` (143 linjer) i: fetch → parse → create_ticket → update_state.

**26.** Split `create-ticket-form.tsx` (787 linjer) i: form-hook + field-components + submission-logic.

**27.** Split `kanban-board-view.tsx` (657 linjer) i: board-container + column + card + drag-handlers.

**28.** Split `sf-chat-agent-console.tsx` (495 linjer) i: chat-window + message-list + input + actions.

**29.** Generel regel: **ingen funktion over 50 linjer, ingen fil over 400 linjer**. Håndhæv med Ruff (`C901` complexity, `PLR0915` statements).

**30.** Extrahér alle inline SQL-queries (22× `text()`) til et `queries/`-modul eller ORM-metoder.

### TEST (31-38)

**31.** Opret frontend test-suite: start med `create-ticket-form.tsx`, `kanban-board-view.tsx`, `service-desk-view.tsx`.

**32.** Tilføj integration tests der tester API→DB→response end-to-end (ikke kun unit tests).

**33.** Tilføj contract tests: verificér at API-responses matcher Pydantic-schemas.

**34.** Opret test-fixtures for de mest brugte entiteter (ticket, user, team, org) — undgå duplikering i test-setup.

**35.** Tilføj snapshot tests for komplekse API-responses (ticket-detail med alle relationer).

**36.** Expand e2e tests fra 1 fil til mindst de 5 vigtigste user-flows.

**37.** Tilføj performance-regression tests: assert at list-endpoints svarer inden for X ms.

**38.** Tilføj test for permission boundaries: verificér at en `end_user` IKKE kan tilgå agent-endpoints.

### LINTING & ENFORCEMENT (39-44)

**39.** Aktivér Ruff-regler: `C90` (complexity), `D` (docstrings), `S` (security), `SIM` (simplification), `PTH` (pathlib), `RET` (return), `ARG` (unused arguments).

**40.** Tilføj pre-commit hooks: `ruff check`, `ruff format`, `eslint`, `tsc --noEmit`. Ingen kode merger uden at passere.

**41.** Tilføj CI-enforcement: GitHub Actions der kører linting + tests på alle PR's.

**42.** Aktivér `eslint-plugin-react-hooks` exhaustive-deps reglen (fanger stale closures i useEffect).

**43.** Pin dependencies med exact versions i `requirements.txt` (`==` ikke `>=`). Brug `uv.lock` som source of truth.

**44.** Tilføj `renovate` eller `dependabot` for automatiske dependency-updates med PR's.

### DOKUMENTATION (45-48)

**45.** Tilføj docstrings til alle 144 router-funktioner. Mindst: hvad gør endpointet, hvem kan kalde det, hvad returnerer det.

**46.** Generér OpenAPI-dokumentation automatisk fra Pydantic-schemas + router-docstrings. FastAPI gør dette gratis — men kun hvis schemas og docstrings er til stede.

**47.** Tilføj en `CHANGELOG.md` der følger [Keep a Changelog](https://keepachangelog.com/) formatet.

**48.** Tilføj ADRs (Architecture Decision Records) for de vigtigste valg: hvorfor HS256, hvorfor Vercel, hvorfor Neon, hvorfor no-ORM-eager-loading.

### KODESTIL & MØNSTRE (49-50)

**49.** Standardisér error-response format: alle fejl skal have `{"detail": "...", "code": "...", "field": "..."}` — ikke bare en string.

**50.** Tilføj en `Makefile` target for "full local quality check": `make check` → ruff + eslint + tsc + pytest + vitest (alt i én kommando).

---

## Prioriteret handlingsplan

| Uge | Fokus | Punkter | Effort |
|-----|-------|---------|--------|
| 1 | **Quick wins** — linting, hooks, typing-start | #39, #40, #43, #1 (top 20 routers) | 1 dag |
| 2 | **DRY** — permission-decorator, ticket-repository | #11, #12, #18 | 1 dag |
| 3 | **SRP** — split tickets.py | #21, #29 | 1-2 dage |
| 4 | **Test** — frontend test-suite start, integration tests | #31, #32, #38 | 2 dage |
| 5+ | **Løbende** — resten af punkterne, 5 per uge | #2-#50 | løbende |

---

## Konklusion

STARDESK scorer **7/10** på generel kodekvalitet. Det er over gennemsnittet — services-laget er professionelt, kode-hygiejnen er upåklagelig, og arkitekturen er sund.

De tre største huller er:

1. **SRP-brud i routers** (tickets.py som God-router med alt blandet sammen)
2. **DRY-brud** (72 gentagne permission-checks, 14 duplikerede ticket-fetches)
3. **Test-gæld** (2 frontend-tests mod 33.800 linjer UI-kode)

Alle tre er fixbare indenfor 1-2 sprints uden at ændre arkitekturen. Det kræver refaktorering, ikke omskrivning.

---

## Næste skridt for Cursor

Start med at debattere de **10 TYPING-punkter** (1-10). For hvert:
1. Er det en reel kvalitetsforbedring i denne codebase?
2. Hvad er den mest pragmatiske måde at gøre det på?
3. Kan det gøres inkrementelt (fil for fil) uden at bryde noget?

Præsentér som tabel og vent på godkendelse.
