# API-reference (v1)

Base URL (prod): `https://api-gamma-amber.vercel.app`  
Præfiks: `/api/v1`  
Auth: `Authorization: Bearer <JWT>` (undtagen login og health)

Fra browser bruges proxy: `/api/proxy/v1/...` på web-domænet.

## Auth

| Metode | Sti | Auth | Body |
|--------|-----|------|------|
| POST | `/auth/login` | Nej | `{ "email", "password" }` |
| GET | `/auth/me` | Ja | — |

Web login: `POST /api/auth/login` (sætter cookies).

## Tickets

| Metode | Sti | Rolle | Note |
|--------|-----|-------|------|
| GET | `/tickets` | Alle med adgang | Query: `board`, `major_open`, `q` |
| GET | `/tickets/llm-eval-pack` | agent, admin | Batch LLM-kontekst |
| POST | `/tickets` | authenticated | Opret sag |
| GET | `/tickets/{id}` | adgang til sag | Detalje + intelligence (staff) |
| PATCH | `/tickets/{id}` | reporter/staff | Status m.m. |
| PATCH | `/tickets/{id}/metadata` | staff | Tags, emoji, underårsager |
| PATCH | `/tickets/{id}/assignment` | agent, admin | Tildeling |
| GET | `/tickets/{id}/llm-context` | agent, admin | LLM-dokument |
| PATCH | `/tickets/{id}/intelligence` | agent, admin | Gem triage-metadata |
| POST | `/tickets/{id}/comments` | adgang | Kommentar |
| POST | `/tickets/{id}/attachments` | staff/reporter | Upload |
| GET | `/tickets/{id}/attachments/{aid}/download` | adgang + clean scan | Fil |

### Liste-query

- `board=true` — dispatch: org-filter for virksomheds-agent; alle for admin
- `major_open=true` — åbne stor-sager
- `q=` — søg titel, beskrivelse, sagsnr., tags

### Assignment body

```json
{
  "assigned_team_id": "uuid",
  "assigned_user_id": null,
  "assignment_reason": "påkrævet tekst",
  "fault_displayed": false
}
```

## Teams, kategorier, underårsager

| Metode | Sti |
|--------|-----|
| GET | `/teams` |
| GET | `/teams/{id}` |
| GET | `/categories` |
| GET | `/sub-causes?category_id=` |

## Rapporter

| Metode | Sti | Rolle |
|--------|-----|-------|
| GET | `/reports/dashboard` | agent, admin |
| GET | `/reports/standard?period_days=&bucket=` | agent, admin |
| GET | `/reports/standard/export?...` | CSV |

## Admin

| Metode | Sti | Rolle | Note |
|--------|-----|-------|------|
| POST | `/admin/reset-sla` | admin, top_admin | Genberegn SLA for alle ikke-slettede sager |

Query: `dry_run=true` (tæl kun), `anchor=created_at` (standard, som prioritetsændring) eller `anchor=now` (nye frister fra nu).

## Integration (hemmelighed påkrævet i production)

| Metode | Sti | Header |
|--------|-----|--------|
| POST | `/cron/sla-check` | `Authorization: Bearer <CRON_SECRET>` |
| POST | `/cron/virus-scan` | samme |
| POST | `/webhooks/email-inbound` | `X-Webhook-Secret: <WEBHOOK_SECRET>` |

## Health

`GET /health` — ingen auth

## Fejlkoder

| Status | Typisk årsag |
|--------|----------------|
| 401 | Manglende/udløbet token |
| 403 | Rolle eller org-adgang |
| 404 | Sag findes ikke eller slettet |
| 503 | JWT eller integration secret ikke konfigureret |

Fejlformat: RFC 7807-lignende JSON med `detail`.

## Pydantic / TypeScript

- API schemas: `apps/api/src/star_itsm_api/schemas/`
- Web types: `apps/web/src/types/`
