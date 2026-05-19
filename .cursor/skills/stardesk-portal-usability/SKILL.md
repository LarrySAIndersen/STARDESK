---
name: stardesk-portal-usability
description: >-
  Critiques and improves STARdesk customer portal (selvbetjening) UX for borger-facing
  end users. Use when auditing /portal, portal knowledge, ticket creation flows,
  Danish copy, accessibility, or when the user asks for portal usability review.
---

# STARdesk portal usability

## Scope

Review the **customer portal** (not staff agent UI):

| Route | Purpose |
|-------|---------|
| `/portal` | Home — hero, categories, mine sager |
| `/portal/knowledge` | Knowledge search and articles |
| `/tickets/new` | Create case (end-user intake) |

Key files: `end-user-ticket-portal.tsx`, `portal/page.tsx`, `portal-sidebar.tsx`, `portal/knowledge/*`, `portal-shell*`, `portal-top-bar.tsx`, `portal-knowledge-search.tsx`.

## Review workflow

1. **Walk the end_user flow** — login → portal home → search knowledge → create case → view mine sager.
2. **Capture evidence** — note viewport (desktop + mobile), role (`end_user` vs staff preview), and screenshot paths under `STARDESK/Background/` or project screenshots folder.
3. **Apply heuristics** (Nielsen 10, condensed):
   - Visibility of system status (loading, empty, errors in Danish)
   - Match real world (borger language, not ITSM jargon)
   - User control (clear back paths, cancel on forms)
   - Consistency with STAR wireframe patterns
   - Error prevention and recovery (plain-language errors)
   - Recognition over recall (labels not truncated; status visible)
   - Flexibility (search + create case equally reachable)
   - Aesthetic/minimal (no staff-only chrome on portal)
4. **Accessibility basics** — focus order, `aria-label` on nav/search, contrast on hero, touch targets ≥44px on mobile, table semantics or list alternatives.
5. **STAR-specific**
   - Danish copy throughout; short, active voice
   - Audience: **borger / slutbruger**, not administrator or agent
   - Role display: «Borger», not «Administrator»
   - No SLA/agent columns unless clearly explained to citizens

## Checklist

Copy and track:

```
Portal UX checklist:
- [ ] Sidebar labels fully readable (no «Vidensarti...» truncation when expanded)
- [ ] Mine sager: sagsnr + readable title + status + date (not only INC + cryptic slug)
- [ ] Hero: prominent search AND «Opret sag» CTA
- [ ] Knowledge: search obvious; articles reachable; empty state helpful
- [ ] Create case path obvious from home, sidebar, and hero
- [ ] Mobile: nav, hero CTAs, table/list usable
- [ ] Empty states: no tickets, no articles, API error — actionable Danish text
- [ ] Error messages: plain language, what to do next
- [ ] Role/top bar: borger-appropriate labels on portal
- [ ] Staff preview: no confusing admin labels for citizen test accounts
```

## Severity

| Level | Danish | When |
|-------|--------|------|
| kritisk | Blocks task (cannot create case, cannot read own tickets) |
| høj | Major confusion or wrong audience (staff UI on portal) |
| medium | Hurts efficiency (truncation, weak empty state) |
| lav | Polish, copy tweak, minor a11y |

## Output format

Deliver an audit report:

```markdown
# Portal usability audit — [date]

## Executive summary
[1–2 sentences]

## Findings

| ID | Severity | Område | Fund | Skærmbillede | Anbefalet fix |
|----|----------|--------|------|--------------|---------------|
| P1 | høj | Mine sager | ... | `path/to.png` | ... |

## Recommended fixes (prioritized)
1. ...
2. ...

## Files to change
- `apps/web/src/components/...`
```

After audit, implement fixes starting with **kritisk** and **høj**, then verify `npm run build` in `STARDESK/apps/web`.

## Implementation patterns

- Sidebar: `whitespace-nowrap` + `title` on nav items; adequate `PORTAL_NAV` width
- Mine sager: `wire-table-grid-portal-tickets` (sagsnr, titel, status, oprettet)
- Hero: dual CTA — `Søg vidensbase` → `/portal/knowledge?focus=search`, `Opret sag` → `/tickets/new`
- Role: `portalRoleLabel()` in `portal-access.ts` — `end_user` → «Borger»
- Knowledge hero link: `/portal/knowledge?focus=search` for search focus
