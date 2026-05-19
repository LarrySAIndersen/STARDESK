# STARDESK anti-patterns — extended reference

Use with [SKILL.md](SKILL.md). This file is optional detail for deep audits.

## File index (canonical patterns)

| Concern | Canonical “good” location |
|---------|---------------------------|
| Client API + cache | `apps/web/src/lib/api.ts` |
| Server API + cache | `apps/web/src/lib/api-server.ts` |
| Error / must_change_password | `apps/web/src/lib/api-errors.ts` |
| Cookies / client user | `apps/web/src/lib/auth.ts` |
| Auth route cookies | `apps/web/src/app/api/auth/**/route.ts` |
| API proxy | `apps/web/src/app/api/proxy/**` |
| Security deps | `apps/api/src/star_itsm_api/core/security.py` |
| CPR validation | `apps/api/src/star_itsm_api/services/cpr.py`, `apps/web/src/lib/cpr.ts` |
| Demo login gate | `apps/web/src/lib/demo-login.ts` |
| Portal shell | `apps/web/src/components/portal/portal-shell*.tsx` |

## Web — extra checks

| Anti-pattern | What to look for | Fix hint |
|--------------|------------------|----------|
| Bearer token in URL | `?token=` query params | Cookie or POST body only |
| `credentials: 'omit'` on same-origin API | Broken cookie auth | `include` or default for `/api/` |
| SWR/React Query without `revalidateOnFocus` policy | Stale ticket detail | Align with `no-store` semantics |
| `dangerouslySetInnerHTML` on user content | XSS | Sanitize or plain text |
| Missing `key` on mapped lists | State bugs in ticket tables | Stable ids |
| Staff role on portal preview | Wrong labels for borger | Force `end_user` display in portal |
| `next/image` unconfigured remote host | Build/runtime failure | `next.config` images.domains |
| Env var in client bundle | `process.env.SECRET` without `NEXT_PUBLIC_` prefix misuse | Server-only secrets in RSC/routes |

## API — extra checks

| Anti-pattern | What to look for | Fix hint |
|--------------|------------------|----------|
| `require_staff` on citizen-only route | End user blocked | `get_current_user` + org scope |
| Missing org filter on tickets | Cross-tenant leak | `org_access.py` |
| `HTTPException(detail=str(e))` | Internal exception text to client | Generic Danish message + log server-side |
| File upload without size/type check | DoS / malware | Match attachment service limits |
| Cron/webhook without secret in prod | Open endpoints | `CRON_SECRET`, `WEBHOOK_SECRET` per docs |
| Sync blocking call in async route | Event loop block | `asyncio.to_thread` or async driver |
| Missing `deleted_at` filter | Soft-deleted rows exposed | Consistent `where deleted_at.is_(None)` |
| Idempotency missing on webhooks | Duplicate tickets | Store event ids |

## Security — extra checks

| Anti-pattern | What to look for | Fix hint |
|--------------|------------------|----------|
| CORS `*` with credentials | CSRF risk | Vercel regex in `main.py` |
| JWT in git history | Rotated secret needed | Rotate `JWT_SECRET`, purge history if leaked |
| `.env.example` with real values | Copy-paste prod leak | Placeholders only |
| Attachment path traversal | `../` in filename | Sanitize stored names |
| Missing rate limit on login | Brute force | Platform or middleware limit |
| PII in analytics/events | Full email/CPR in telemetry | Hash or omit |

## UX — extra checks

| Anti-pattern | What to look for | Fix hint |
|--------------|------------------|----------|
| ITSM jargon on portal | "INC", "assignment group" | Borger Danish labels |
| Empty state without CTA | Dead-end lists | Link to create case / knowledge |
| Loading spinner without text | Screen reader gap | `aria-live` polite status |
| Color-only status | Accessibility | Icon + text label |
| Mobile table horizontal scroll without hint | Usability | Card layout or priority columns |
| Duplicate "Opret sag" CTAs competing | Cognitive load | One primary per viewport |
| Wrong datetime locale | `en-US` on Danish portal | `da-DK` formatting |
| LLM assistant without disclaimer | Trust risk | Label as suggestion not decision |

## Severity rubric (full)

| Level | Security | UX | Performance |
|-------|----------|-----|-------------|
| kritisk | Exploit or PII leak | — | — |
| høj | Authz wrong | Blocks core task | — |
| medium | Defense in depth | Major confusion | N+1 / unbounded list |
| lav | Hardening | Polish | Minor cache |

## Report examples

**Good row:**

| category | anti-pattern | file/location | severity | fix hint |
|----------|--------------|---------------|----------|----------|
| Web | Raw API error strings | `ticket-detail.tsx:toast` | høj | Wrap with `apiErrorMessage(parseApiErrorDetail(...))` |

**Bad row (too vague):**

| Web | Bad error handling | frontend | medium | Fix errors |

## Related automation

- Dependency CVEs: `scripts/security-audit/run-audit.mjs`
- Usability script: `scripts/usability-test.mjs`
- Destructive/load skills (if present): see `docs/DOCUMENTATION.md`
