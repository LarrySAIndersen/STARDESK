# Nulstil SLA for alle sager

Genberegner `response_due_at` og `resolution_due_at` efter gældende SLA-politik (prioritet, kategori, DB-tildelinger) og nulstiller eskalering (`escalation_level`, `last_escalation_at`).

`sla_breached` er afledt ved læsning — der er ingen separat kolonne.

`first_response_at` og øvrige aktivitetstidsstempler ændres **ikke**.

## Anker (anchor)

| Værdi | Adfærd |
|-------|--------|
| `created_at` (standard) | Samme som ved manuel prioritetsændring: frister fra sagens `created_at` |
| `now` | Nye frister fra kørselstidspunktet |

## API (anbefalet)

Kræver admin-JWT. Kør først dry-run:

```bash
curl -sS -X POST "https://api-gamma-amber.vercel.app/api/v1/admin/reset-sla?dry_run=true" \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

Udfør reset (standard: fra `created_at`):

```bash
curl -sS -X POST "https://api-gamma-amber.vercel.app/api/v1/admin/reset-sla" \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

Frister fra nu:

```bash
curl -sS -X POST "https://api-gamma-amber.vercel.app/api/v1/admin/reset-sla?anchor=now" \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

Lokal via web-proxy (efter login):

```bash
curl -sS -X POST "http://localhost:3000/api/proxy/v1/admin/reset-sla?dry_run=true" \
  -H "Cookie: <session cookies>"
```

## CLI mod database

Kør fra repo-roden med `DATABASE_URL` (fx fra `apps/api/.env`):

```bash
cd apps/api
uv run python ../../scripts/reset_sla.py --dry-run
uv run python ../../scripts/reset_sla.py
uv run python ../../scripts/reset_sla.py --anchor now
```

Endpointet er at foretrække i production (samme auth-spor og deploy).
