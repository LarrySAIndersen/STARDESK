---
name: stardesk-anti-patterns
description: >-
  Audits STARDESK (Next.js web + FastAPI API) for common anti-patterns in auth,
  caching, security, API design, and portal/staff UX. Use when reviewing PRs,
  pre-merge checks, security reviews, or when the user asks for anti-pattern scan.
---

# STARDESK anti-patterns audit

## Scope

| Layer | Paths |
|-------|--------|
| Web | `apps/web/src/` — App Router, `lib/api*.ts`, `lib/auth.ts`, portal + agent components |
| API | `apps/api/src/star_itsm_api/` — routers, services, `core/security.py` |
| Config | `.env.example`, `.gitignore`, Vercel/Railway env docs |

Related skills: [stardesk-portal-usability](../../../../.cursor/skills/stardesk-portal-usability/SKILL.md) (borger UX depth). Extended checklist: [reference.md](reference.md).

## Workflow

1. **Clarify scope** — full repo vs. changed files (`git diff --name-only`). Default: diff + touched neighbours.
2. **Scan by category** — use detection hints below (grep/semantic search). Read surrounding code before flagging.
3. **Deduplicate** — one row per distinct issue; merge repeated instances in location column.
4. **Severity**
   - **kritisk** — security/data leak, auth bypass, PII in logs, prod secret exposure
   - **høj** — wrong auth guard, user-facing raw errors, missing auth on server fetch, blocking wrong users
   - **medium** — cache staleness, N+1, pagination gaps, a11y gaps, UX confusion
   - **lav** — polish, truncation when expanded, non-wireframe styling where trivial
5. **Deliver report** — format below. No code changes unless the user asks to fix.

## Output format

Markdown table (required columns):

```markdown
# STARDESK anti-patterns — [date]

| category | anti-pattern | file/location | severity | fix hint |
|----------|--------------|---------------|----------|----------|
| Web | … | `path:line` or component | kritisk/høj/medium/lav | One-line actionable fix |
```

Optional short executive summary (2–3 sentences) above the table.

---

## Web (Next.js / React)

### Client-only auth secrets in localStorage

**Anti-pattern:** JWT, API keys, or refresh tokens in `localStorage` / `sessionStorage` for sensitive session state.

**Good:** HttpOnly cookies via Next route handlers; client reads non-sensitive `USER_COOKIE` only. See `apps/web/src/lib/auth.ts`, `api/proxy`.

**Detect:** `localStorage.setItem`, `sessionStorage` + `token` / `jwt` / `secret`.

### `must_change_password` leaked to wrong UI

**Anti-pattern:** Showing `MUST_CHANGE_PASSWORD_MESSAGE` ("Du skal skifte adgangskode…") in modals, toasts, or generic API errors instead of redirect/neutral copy.

**Good:** `apps/web/src/lib/api-errors.ts` — `MUTATION_FORBIDDEN_MESSAGE` for 403; first-login copy only on `/skift-adgangskode` and login redirect. `api.ts` / `api-server.ts` redirect when session has `must_change_password`.

**Detect:** `must_change_password`, `MUST_CHANGE_PASSWORD_MESSAGE` outside change-password/login paths; `detail` shown raw without `apiErrorMessage()`.

### Missing `cache: 'no-store'` on dynamic data

**Anti-pattern:** Client `fetch` or server `fetch` without `cache: 'no-store'` (or wrong `revalidate`) for user-specific lists, tickets, session, counts.

**Good:** Default in `apiGet` / `apiPost*` (`lib/api.ts`); `apiGetServer` uses `no-store` unless explicit `revalidate` for static reference data (`lib/api-server.ts`).

**Detect:** `fetch(` in components/pages without `cache` / `next.revalidate` on authenticated paths.

### Server components fetching without auth

**Anti-pattern:** RSC `fetch` to backend without `Authorization` from cookies; public proxy exposing private routes.

**Good:** `apiGetServer` + `authHeaders()` from `TOKEN_COOKIE`; layout guards on protected segments.

**Detect:** `fetch(buildBackendUrl` / direct API URL in `app/**/page.tsx` without `apiGetServer` or cookie headers.

### Raw API error strings shown to users

**Anti-pattern:** `response.json().detail`, `err.message`, or FastAPI validation blobs rendered verbatim (English, stack traces, internal codes).

**Good:** `parseApiErrorDetail` + `apiErrorMessage`; Danish user copy in forms; map known codes.

**Detect:** `.detail` in JSX toast/alert without `apiErrorMessage`; `throw new Error(detail)`.

### `readOnly` traps on forms

**Anti-pattern:** `readOnly` on inputs that should be editable, or `disabled` without explanation blocking submit; staff cannot complete required fields.

**Detect:** `readOnly`, `disabled={!canEdit}` on ticket/portal forms — verify role + `must_change_password` state.

### Duplicate nav / logo

**Anti-pattern:** Logo or primary nav repeated in shell + top bar + page header (portal or agent).

**Good:** Single brand in `portal-shell*` / `agent-sidebar` + one `PortalTopBar` / agent top bar.

**Detect:** Multiple `<Image` / logo components in same layout tree; duplicate `SiteHeader` + sidebar brand.

### Missing aria labels

**Anti-pattern:** Icon-only buttons/links (nav collapse, reactions, theme toggle) without `aria-label` or visible text; search without `aria-labelledby`.

**Detect:** `<button` with only SVG/icon children and no `aria-label` / `title` (portal sidebar collapse is a known hotspot).

### Inline styles breaking wireframe system

**Anti-pattern:** `style={{ ... }}` for layout/colors/fonts where `globals.css` wireframe tokens (`--star-*`, `wire-*`, Tailwind `@apply`) should apply.

**Acceptable:** Dynamic chart positions, resize handles, third-party canvas (e.g. asset graph).

**Detect:** `style={{` in portal/agent chrome (not charts).

---

## API (FastAPI)

### `get_current_user` on admin routes needing `require_admin_session`

**Anti-pattern:** User-admin or team-admin `PATCH`/`POST` using `Depends(get_current_user)` or `require_admin()` so admins with `must_change_password` cannot manage users, or wrong gate vs. session-only admin.

**Good:** `require_admin_session()` in `core/security.py` for user/team admin mutations (`routers/users.py`, `teams.py`). Tests: `test_users_admin.py`, `test_teams_admin.py`.

**Detect:** Admin routers with `get_current_user` on write endpoints; compare to `require_admin_session`.

### N+1 queries in list endpoints

**Anti-pattern:** List route loads parent rows then queries related org/user/category per row in a loop.

**Good:** Eager load (`selectinload` / joined load) or single aggregated query in service layer.

**Detect:** `for item in rows: await db.get` / repeated `execute(select` inside loops in `routers/` or `services/`.

### Missing pagination limits

**Anti-pattern:** Unbounded `limit` query param, no `le=` on `Query`, or list endpoints returning full table.

**Good:** Pattern in `tickets.py` (`page_size` ge/le, capped `limit`); mirror on new list routes.

**Detect:** `limit: int = Query` without `le=`; missing `offset`/`page` on large tables.

### Secrets in logs

**Anti-pattern:** Logging passwords, tokens, `JWT_SECRET`, webhook payloads with credentials, full request bodies on auth routes.

**Good:** `logger.exception` with IDs only; redact in middleware.

**Detect:** `logger.*password`, `logger.*token`, `print(`, f-strings with `payload` on login/webhook handlers.

### SQL string concat

**Anti-pattern:** Raw SQL built with f-strings or `+` from user input.

**Good:** SQLAlchemy `select()` / bound parameters; migrations in `docs/*.sql` only.

**Detect:** `text(f"`, `execute(f"`, string concat near `WHERE`.

### No input validation on PATCH

**Anti-pattern:** `PATCH` body applied with `**payload.dict()` or setattr without Pydantic schema / partial update model.

**Good:** Dedicated `*Update` schemas with `model_config` extra forbid; field validators (see `schemas/ticket.py` CPR validators).

**Detect:** `def patch_*` without typed body model or with `dict` type.

### Blocking mutations with `must_change_password` on wrong routes

**Anti-pattern:** `ensure_password_changed` blocking admin user-management, or conversely allowing dangerous `POST` while flag is set (except documented Option A GET allowlist).

**Good:** `get_current_user` blocks non-GET mutations; admin user routes use `require_admin_session`. Tests: `test_must_change_password.py`.

**Detect:** New mutation routes on `get_current_user` without test coverage for `must_change_password=True`.

---

## Security

### `.env` committed patterns

**Anti-pattern:** `.env`, `.env.production`, or files with live secrets tracked in git; missing `.gitignore` entries.

**Good:** `.gitignore` blocks `.env*` except `.env.example`; secrets only in Vercel/Railway.

**Detect:** `git ls-files` / grep for `JWT_SECRET=`, `sk-`, password literals in non-example files.

### Mock auth in production without flag

**Anti-pattern:** Demo login table, bypass auth, or test users shown when `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` is not explicitly enabled for non-prod.

**Good:** `lib/demo-login.ts` gated by env; docs: hardened prod sets flag false.

**Detect:** `demo-users`, `ENABLE_DEMO` without `process.env` guard; conftest overrides in non-test code paths.

### CPR in logs

**Anti-pattern:** Logging `subject_cpr`, free-text fields, or ticket descriptions without redaction.

**Good:** `services/cpr.py`, `assert_no_cpr_in_free_text` on create; never log CPR field.

**Detect:** `logger` / `print` near `subject_cpr`, `cpr`, ticket `description` on create/update.

### Missing HTTPS-only cookies in prod

**Anti-pattern:** Auth cookies set without `Secure` in production, or `httpOnly: false` on token cookie without documented threat model.

**Good:** `secure: process.env.NODE_ENV === "production"` in auth routes; `auth.ts` `Secure` flag on HTTPS.

**Detect:** `setCookie` / `document.cookie` without `Secure` when `NODE_ENV === "production"`.

---

## UX (portal + staff)

### Truncated labels

**Anti-pattern:** Sidebar/nav labels clipped (`truncate`) while rail is expanded; table titles unreadable without hover `title`.

**Known area:** `portal-sidebar.tsx`, `portal-my-tickets-table.tsx` — expanded nav should use `whitespace-nowrap` or wider rail.

**Detect:** `truncate` on nav text when `!collapsed`.

### Placeholder data shown as real (dupe-b)

**Anti-pattern:** Mock/seed/demo rows rendered without "(eksempeldata)" or `source === "mock"` badge — users trust fake tickets/users/metrics.

**Good:** Pattern in `admin-dependencies-panel.tsx` (`report.source === "mock"`).

**Detect:** hardcoded arrays, `MOCK_`, `demo` data in production components without label.

### Icon-only nav without tooltips / labels

**Anti-pattern:** Collapsed sidebar or bottom nav: icons only, no `title`, `aria-label`, or tooltip.

**Good:** `aria-label` on collapse toggle; visible labels when expanded.

**Detect:** Portal/agent nav items with icon-only `Link` and no accessible name.

---

## Quick scan commands

Run from repo root (`STARDESK/`):

```bash
# Secrets / env
git ls-files | rg '\.env$|\.env\.' 

# must_change_password UI leaks
rg 'must_change_password|MUST_CHANGE_PASSWORD_MESSAGE' apps/web/src --glob '!*api-errors*'

# Admin session guards
rg 'get_current_user|require_admin_session' apps/api/src/star_itsm_api/routers

# Client fetch without no-store (manual review)
rg 'fetch\(' apps/web/src/app apps/web/src/components -g '*.test.*'

# CPR logging risk
rg 'logger\.(info|debug|warning|error).*cpr|subject_cpr' apps/api -i

# Inline styles in chrome
rg 'style=\{\{' apps/web/src/components/portal apps/web/src/components/agent
```

---

## Additional resources

- Extended checklist and file index: [reference.md](reference.md)
- Auth design: `docs/design-decisions.md`
- API guards: `apps/api/src/star_itsm_api/core/security.py`
- Error mapping: `apps/web/src/lib/api-errors.ts`
