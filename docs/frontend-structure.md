# Frontend-struktur (Next.js)

App: `apps/web/`  
Sprog: TypeScript, dansk UI.

## Ruter

| Sti | Fil | Beskrivelse |
|-----|-----|-------------|
| `/` | `src/app/page.tsx` | Forside / sagsoversigt (Suspense) |
| `/login` | `src/app/login/page.tsx` | Login + demo-brugere |
| `/tickets/new` | `src/app/tickets/new/page.tsx` | Opret sag |
| `/tickets/[id]` | `src/app/tickets/[id]/page.tsx` | Sagdetalje (server fetch) |
| `/groups` | `src/app/groups/page.tsx` | Gruppeoversigt (staff) |
| `/reports` | `src/app/reports/page.tsx` | Rapporter (staff) |

## API-ruter (Next server)

| Sti | Fil | Formål |
|-----|-----|--------|
| `POST /api/auth/login` | `app/api/auth/login/route.ts` | HttpOnly session |
| `POST /api/auth/logout` | `app/api/auth/logout/route.ts` | Ryd cookies |
| `/api/proxy/*` | `app/api/proxy/[...path]/route.ts` | Proxy til backend med token |

## Vigtige komponenter

| Komponent | Fil |
|-----------|-----|
| Agent workspace (dashboard + dispatch) | `components/agent-workspace.tsx` |
| Dispatch board | `components/agent-dispatch-board.tsx` |
| Login + demo picker | `components/login-form.tsx`, `demo-user-picker.tsx` |
| Sagdetalje | `components/ticket-detail.tsx` |
| LLM-panel | `components/ticket-intelligence-panel.tsx` |

## Klient-biblioteker

| Fil | Indhold |
|-----|---------|
| `lib/api.ts` | Browser fetch → `/api/proxy/v1/...` |
| `lib/api-server.ts` | Server Components → direkte backend |
| `lib/auth.ts` | Cookies, roller |
| `lib/demo-users.ts` | Testbrugere (synk med seed) |
| `lib/demo-login.ts` | `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` |

## Middleware

`src/middleware.ts` — kræver `stardesk_token` cookie; undtagen `/login`.

## Miljøvariabler (web)

Se `.env.example`: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ENABLE_DEMO_LOGIN`.
