# STARDESK — 50-Punkt Performance-optimering

> **Formål:** Prioriteret performance-plan for hele STARDESK-kodebasen.
> **Workflow:** Hvert punkt starter med at AI'en (dig) **debatterer forslaget**: er det en reel flaskehals? Hvad vinder vi? Hvad koster det? Først derefter implementeres.
> **Prioritet:** KRITISK (1-10) → HØJ (11-25) → MEDIUM (26-40) → LAV (41-50)
> **Kontekst:** FastAPI + Next.js 15 + SQLAlchemy async + PostgreSQL (Neon), deployed on Vercel serverless
> **Baseline:** ~73.500 LoC · 32 modeller · 26 ticket-endpoints · pool_size=10 · 0 eager-loads · 0 cache

---

## INSTRUKTION TIL CURSOR

**Før du implementerer noget:**
1. Læs hele dette dokument
2. For hvert punkt: debattér med dig selv — er det en reel flaskehals i STARDESK? Hvad er den målbare gevinst? Hvad er risikoen ved ændringen?
3. Overvej: er det en kode-ændring, en config-ændring, eller en arkitektur-ændring?
4. Formulér din anbefaling (implementér / benchmark først / udskyd / afvis med begrundelse)
5. Præsentér din plan for mig **før** du skriver kode
6. For DB-ændringer: vis den forventede query plan (EXPLAIN ANALYZE) før og efter

**Princip:** Performance-optimering uden målinger er gætteri. Mål, forstå, fix — i den rækkefølge.

---

## KRITISK (1-10) — Største performance-gevinst nu

### 1. Nul eager-loading i hele codebasen
**Filer:** Alle services der bruger SQLAlchemy relationships
**Fakta:** `grep -rn "joinedload|selectinload|subqueryload" apps/api/src → 0 resultater`
**Impact:** Enhver relationship-access i async context = separat query. En ticket-detail med comments, stakeholders, events, attachments = 5+ queries. En liste med 50 tickets = potentielt 250+ queries.
**Debat-spørgsmål:** Hvilke endpoints er mest trafikerede? Hvilke relationer tilgås oftest? `selectinload` vs `joinedload` — hvornår er hvilken bedst?
**Retning:**
```python
# Prioritér disse endpoints:
# 1. GET /tickets (list) — selectinload for team, assigned_user
# 2. GET /tickets/{id} (detail) — selectinload for comments, events, stakeholders, attachments
# 3. GET /kanban/boards/{id}/columns — selectinload for tickets
stmt = select(Ticket).options(
    selectinload(Ticket.assigned_user),
    selectinload(Ticket.team),
).where(...)
```
**Estimat:** 50-80% færre DB-queries på list/detail endpoints. 2-4 timer.

### 2. N+1: `await db.delete()` i for-loop (teams.py)
**Fil:** `services/teams.py:73-74`
**Fakta:** Hvert team-member slettes individuelt med `await db.delete(membership)` inde i en for-loop.
**Debat-spørgsmål:** Hvor mange members har et typisk team? Er det 3 eller 300?
**Retning:**
```python
# Før: N queries
for membership in existing.scalars().all():
    await db.delete(membership)

# Efter: 1 query
from sqlalchemy import delete
await db.execute(delete(TeamMembership).where(TeamMembership.team_id == team_id))
```
**Estimat:** N→1 queries. 15 min.

### 3. N+1: iterativ select i category_admin.py
**Fil:** `services/category_admin.py:217,238`
**Fakta:** For hver category i en bulk-operation køres en separat `select()` + evt. nested select for subcategories.
**Debat-spørgsmål:** Hvor mange kategorier importeres typisk? Er det en admin-operation der kører sjældent?
**Retning:** Bulk-fetch alle kategorier i én query, byg et lookup-dict, match in-memory.

### 4. N+1: iterativ org-lookup (org_access.py)
**Fil:** `services/org_access.py:46-47`
**Fakta:** For hvert `INTEGRATION_DEFAULT_ORG_NAMES` navn køres en separat `select()`.
**Retning:** `select(Org).where(Org.name.in_(names))` — én query.

### 5. 14× duplikeret `select(Ticket).where(...)` — ingen central repository
**Filer:** Diverse services
**Fakta:** 14 steder gentages ticket-fetch uden eager-loading options. Ingen delt `get_ticket()` helper.
**Debat-spørgsmål:** Hvilke af de 14 steder tilgår relationer bagefter? De er N+1-kandidater.
**Retning:**
```python
# services/ticket_repository.py (ny fil)
async def get_ticket(db, ticket_id, *, load=None):
    """Central ticket fetch med configurable eager-loading."""
    stmt = select(Ticket).where(Ticket.id == ticket_id)
    for rel in (load or []):
        stmt = stmt.options(selectinload(rel))
    row = (await db.execute(stmt)).scalar_one_or_none()
    if not row:
        raise HTTPException(404, detail="Ticket not found")
    return row
```

### 6. Ingen caching-lag — alle reads rammer DB direkte
**Fakta:** Ingen Redis, ingen TTLCache, ingen lru_cache. Kategorier, SLA-config, teams, bruger-roller læses fra DB på hvert request.
**Debat-spørgsmål:** Hvad er read/write-ratioen for kategorier vs. tickets? Kategorier ændres 1×/måned — tickets 100×/dag.
**Retning:**
```python
# Fase 1: In-process TTLCache for sjældent-ændret data
from cachetools import TTLCache
_cat_cache = TTLCache(maxsize=1, ttl=300)  # 5 min

async def get_categories(db):
    if "cats" in _cat_cache:
        return _cat_cache["cats"]
    cats = (await db.execute(select(Category))).scalars().all()
    _cat_cache["cats"] = cats
    return cats

# Fase 2: Redis for delt cache på tværs af serverless invocations
```
**OBS:** Vercel serverless = kold start per invocation, så in-process cache lever kort. Redis (Upstash) er bedre for serverless.

### 7. BaseHTTPMiddleware buffer hele response i RAM
**Fil:** `middleware/security_headers.py`
**Fakta:** Starlette's `BaseHTTPMiddleware` [læser hele response-body ind i hukommelsen](https://www.starlette.io/middleware/#limitations) før headers kan sættes. For store responses (ticket-export, fil-downloads) = unødigt RAM.
**Debat-spørgsmål:** Hvad er den største response STARDESK returnerer? Er det MBs (filer) eller KBs (JSON)?
**Retning:** Migrér til ren ASGI middleware (ingen body-buffering).

### 8. `pool_recycle=300` er aggressivt for serverless
**Fil:** `db.py:50`
**Fakta:** Connections recycles hvert 5. minut. I serverless med cold starts kan en invocation arve en connection der straks recycles.
**Debat-spørgsmål:** Bruger Neon PostgreSQL idle-timeout? Hvad er Neon's anbefalede pool-settings?
**Retning:** Hæv til 1800 (30 min) eller brug Neon's built-in connection pooler.

### 9. `pool_size=10, max_overflow=20` i serverless
**Fil:** `db.py:48-49`
**Fakta:** Op til 30 connections per invocation. I serverless spinner hver cold start en ny pool → mange parallelle pools kan udtømme Neon's `max_connections`.
**Debat-spørgsmål:** Hvor mange concurrent Vercel functions kører typisk? 10 functions × 30 conns = 300 DB connections.
**Retning:** Sænk til `pool_size=2, max_overflow=3` for serverless. Brug Neon pooler.

### 10. Kun 1 endpoint med `response_model` — ingen Pydantic V2 serializer mode
**Fakta:** 1 af 129 endpoints specificerer `response_model`. Resten serialiserer manuelt.
**Debat-spørgsmål:** Er dette bevidst (for performance) eller en forglemmelse? Pydantic V2 serialisering er hurtig — er den manuelle serialisering hurtigere?
**Retning:** Benchmark. Pydantic V2's `model_serializer` kan faktisk være hurtigere end håndskrevet dict-construction.

---

## HØJ (11-25) — Planlæg indenfor næste sprint

### 11. 100 commit/flush-kald — batch vs. per-operation
**Fakta:** 100 steder kaldes `await db.commit()` eller `await db.flush()`. Mange i for-loops.
**Retning:** Batch commits: flush undervejs, commit én gang til sidst.

### 12. tickets.py: 1651 linjer, 60 imports — import overhead per request
**Fakta:** Vercel serverless cold start importerer hele tickets.py med 60 imports. Mange imports er kun brugt af 1-2 endpoints.
**Retning:** Lazy imports for tunge dependencies. Split router.

### 13. Ticket list endpoint: ingen SELECT-kolonne begrænsning
**Fil:** `services/ticket_read.py`, `routers/tickets.py`
**Fakta:** `select(Ticket)` henter ALLE kolonner. En liste med 50 tickets inkluderer fuld body-tekst, metadata, timestamps — også når kun titel og status vises.
**Retning:** `select(Ticket.id, Ticket.title, Ticket.status, ...)` for list-endpoints.

### 14. 57 ORDER BY-klausuler — manglende indexes
**Fakta:** 57 steder bruges `.order_by()`. Verificér at alle sorterings-kolonner har matching database indexes.
**Retning:** `EXPLAIN ANALYZE` på de mest trafikerede queries. Tilføj composite indexes.

### 15. Ingen query timeout / statement timeout
**Fakta:** Ingen `statement_timeout` konfigureret. En langsom query kan blokere en connection i pool'en.
**Retning:** `SET statement_timeout = '30s'` per session eller i pool config.

### 16. Frontend: kun 8 dynamic imports — resten er statiske
**Fakta:** 8 `next/dynamic` imports i hele frontenden. Store komponenter (787, 657, 594 linjer) loades eagerly.
**Retning:** Dynamic import for routes der ikke er "above the fold": admin-panels, kanban, sf-chat.

### 17. Frontend: `fire-and-forget` brugt 41 steder
**Fakta:** 41 imports af `@/lib/fire-and-forget`. Hvert kald er en ukontrolleret HTTP-request.
**Debat-spørgsmål:** Er alle 41 steder faktisk fire-and-forget? Eller er nogen brugerkritiske (ticket-update)?
**Retning:** Audit. Batch dem der kan batches. Tilføj retry for kritiske.

### 18. Ingen HTTP/2 push eller prefetch hints i API
**Retning:** `Link: <url>; rel=preload` headers for kendte follow-up resources.

### 19. Frontend: 65 filer med useEffect — hydration + client-fetch
**Fakta:** 65 komponenter bruger useEffect. Mange af dem fetcher data client-side efter hydration.
**Retning:** Migrér til Next.js 15 Server Components + `use()` hook hvor muligt. Eliminerer client-side waterfall.

### 20. Gmail service: 942 linjer, kompleks OAuth flow
**Fil:** `services/gmail.py`
**Debat-spørgsmål:** Kører Gmail-kald synkront i request-path, eller er de baggrund? Hvad er latency?
**Retning:** Flyt til background task (Celery/inngest/n8n webhook) hvis det blokerer requests.

### 21. Ticket export — hele datasættet i memory
**Fil:** `services/ticket_export.py`
**Fakta:** Alle tickets loades + konverteres til Excel i memory.
**Retning:** Streaming response med `openpyxl` write-only mode. Eller server-side generation + download-link.

### 22. sf_chat service: 887 linjer, sandsynligvis LLM-kald i request-path
**Fil:** `services/sf_chat.py`
**Debat-spørgsmål:** Blokerer LLM-kald request-threaden? Hvad er timeout?
**Retning:** Streaming response eller background job med polling.

### 23. Ingen database connection health check i pool
**Fakta:** `pool_pre_ping=True` er sat — godt. Men verificér at det faktisk virker med Neon.

### 24. Ingen gzip/brotli kompression på API responses
**Debat-spørgsmål:** Håndterer Vercel CDN kompression? Eller returnerer API ukomprimeret JSON?
**Retning:** `fastapi.middleware.gzip.GZipMiddleware(minimum_size=1000)`.

### 25. Kanban service: 907 linjer — query complexity
**Fil:** `services/kanban_service.py`
**Debat-spørgsmål:** Hvad er query-mønsteret? Henter den hele boardet per request?
**Retning:** Audit queries. Implementér incremental loading (kun ændringer siden sidst).

---

## MEDIUM (26-40) — Planlæg over de næste 1-2 måneder

### 26. Frontend: ingen React.memo() eller useMemo() synligt i store komponenter
Store komponenter (787+ linjer) re-renderer sandsynligvis på enhver prop/state-ændring.

### 27. Frontend: missing `key=` i `.map()` (8 steder)
Forårsager unødige re-renders og reconciliation-overhead.

### 28. Ticket intelligence: 433 linjer — LLM evaluation i request-path?
Verificér om LLM-evaluering blokerer. Flyt til async job.

### 29. Ingen database-side pagination cursor (kun offset/limit)
Offset-pagination degraderer ved høje sideantal. Cursor-pagination er O(1).

### 30. SLA status beregnes per-request
Overvej materialized view eller cached result med TTL.

### 31. Ticket dashboard filters — dynamisk query building
Verificér at filtrering bruger parameteriserede queries og indexes.

### 32. Attachment download — dobbelt-read fra storage?
Verificér at filer streames direkte fra storage, ikke bufferes i memory.

### 33. User import service — single-row inserts i loop
Batch med `db.add_all()` + single commit.

### 34. Frontend: ingen `<Suspense>` boundaries for progressive loading

### 35. Frontend: ingen `next/image` for avatar/attachment thumbnails (7 img-refs)
`<img>` tags har ingen automatic resizing, lazy-loading eller format-optimization.

### 36. API: ingen ETags eller conditional responses (If-None-Match)
Klienten re-fetcher data selv om den ikke er ændret.

### 37. Alembic migrations checker disabled i lifespan
Schema drift risiko. Tilføj read-only schema verification.

### 38. Ingen backend profiling setup (py-spy, cProfile endpoint)

### 39. Frontend bundle: verificér tree-shaking for shadcn/ui og lucide-react

### 40. Database: verificér at UUID primary keys har proper indexes

---

## LAV (41-50) — Løbende forbedring

### 41. Overvej `orjson` response class for hurtigere JSON serialisering
### 42. Tilføj `SELECT ... FOR UPDATE SKIP LOCKED` for SLA-cron for at undgå row contention
### 43. Implementér connection pool metrics (prometheus/datadog)
### 44. Frontend: prefetch links for kendte navigation-paths
### 45. Overvej read-replicas for heavy read-endpoints (reports, dashboards)
### 46. Implementér query result caching med cache-invalidation ved writes
### 47. Frontend: service worker for offline-capable ticket list
### 48. API: implementér batch-endpoints (multi-ticket update i ét kald)
### 49. Overvej edge caching (Vercel Edge Config) for statisk config-data
### 50. Benchmark end-to-end: definér P95 latency targets per endpoint og mål løbende

---

## Performance Quick Wins — Top 5

| # | Fix | Estimeret gevinst | Indsats |
|---|-----|-------------------|---------|
| 1 | Tilføj `selectinload()` på ticket list + detail | **50-80% færre queries** | 2-4 timer |
| 2 | Bulk delete i teams.py | **N→1 queries** | 15 min |
| 3 | TTLCache for kategorier + SLA-config | **~30% færre reads** | 1-2 timer |
| 4 | Sænk pool_size til 2+3 for serverless | **Stabilitet** | 10 min |
| 5 | Dynamic imports for admin/kanban/chat | **Hurtigere initial load** | 1 time |

---

## Næste skridt

Cursor: start med at debattere punkt **1-10** (KRITISK). For hvert:
1. Er det en reel flaskehals i STARDESKs kontekst?
2. Kan du måle den nuværende cost? (estimated query count, latency)
3. Hvad er den bedste løsning givet stakken?
4. Hvad er effort vs. impact?
5. Er der en risiko ved ændringen (regressioner, breaking changes)?

Præsentér dine konklusioner som en tabel:

| # | Punkt | Reel flaskehals? | Løsning | Effort | Risk | Anbefaling |
|---|-------|-----------------|---------|--------|------|------------|

Vent på godkendelse før implementering.
