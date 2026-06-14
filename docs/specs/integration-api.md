# Integration API (stable contract)

Status: **Implemented (v1)**  
Base: `/api/v1/integration/`  
OpenAPI: `GET /openapi.json` (tag: **Integration API**)  
Web UI: `/developers/api` (staff)

## Purpose

Narrow, versioned REST surface for machine-to-machine sync with external ITSM tools
(TOPdesk, Jira, ServiceNow, custom ETL). Staff UI and portal continue to use JWT routes;
integrators should prefer this contract to avoid coupling to internal ticket endpoints.

## Authentication

| Header | Required | Description |
|--------|----------|-------------|
| `X-Integration-Key` | Yes in production when `INTEGRATION_API_KEY` is set | Shared secret for M2M clients |
| `X-Integration-System` | No | Source slug (`topdesk`, `jira`, …); defaults to `external` |

Environment:

- `INTEGRATION_API_KEY` — API key (API project on Vercel)
- `INTEGRATION_ORG_ID` — optional UUID to scope tickets to one organization

In development without a configured key, endpoints are open (same pattern as cron/webhooks).

## Case types (sagstyper)

Fixed catalog (not admin-configurable in v1):

| `id` | Danish label | Prefix |
|------|--------------|--------|
| `incident` | Hændelse | INC |
| `service_request` | Serviceanmodning | SR |
| `problem` | Problem | PRB |

`GET /api/v1/integration/case-types` returns labels, allowed priorities/statuses.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/integration/profile` | Contract version, capabilities, pagination |
| GET | `/integration/case-types` | Sagstype catalog |
| GET | `/integration/tickets` | Paginated list (`page`, `page_size`, `updated_since`, filters) |
| POST | `/integration/tickets` | Create; idempotent on `external_ref` |
| GET | `/integration/tickets/{ticket_ref}` | UUID or `ext:{system}:{external_id}` |
| PATCH | `/integration/tickets/{ticket_ref}` | Limited field update for sync |

## External reference

Stored in `tickets.routing_metadata.integration`:

```json
{
  "integration": {
    "system": "topdesk",
    "external_id": "INC-12345",
    "external_url": "https://…",
    "synced_at": "2026-06-14T12:00:00+00:00"
  }
}
```

Legacy imports using `routing_metadata.external_number` remain readable.

## Create body (example)

```json
{
  "ticket_type": "incident",
  "title": "VPN fejler",
  "description": "Bruger kan ikke forbinde til VPN fra hjemmekontor.",
  "priority": "high",
  "external_ref": {
    "system": "topdesk",
    "external_id": "INC-99881",
    "external_url": "https://topdesk.example/incidents/99881"
  }
}
```

## Tests

- `apps/api/tests/test_integration_api.py`

## Out of scope (v1)

- Per-tenant API keys in database
- Outbound webhooks / event subscriptions
- Configurable case-type catalog (admin CRUD)
- Full RFC 7807 problem details

## Related docs

- `docs/api-reference.md` — staff JWT API overview
- `docs/integrations-slack.md`, `docs/integrations-gmail.md` — OAuth integrations
- `docs/classic-itsm-data-model-mapping.md` — legacy field mapping
