"""OpenAPI schema customization for integrators and internal developers."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

from star_itsm_api.core.config import settings

OPENAPI_DESCRIPTION = """
STARdesk REST API for staff applications and **machine integrations**.

## Authentication

| Surface | Header | Use |
|---------|--------|-----|
| Staff / portal | `Authorization: Bearer <JWT>` | Interactive users via login |
| Integration API | `X-Integration-Key` | TOPdesk, Jira, ServiceNow, custom ETL |
| Cron | `Authorization: Bearer <CRON_SECRET>` | Scheduled jobs |
| Inbound webhook | `X-Webhook-Secret` | Email and similar push |

Optional for integrations: `X-Integration-System` (slug, e.g. `topdesk`).

## Stable integration contract

Endpoints tagged **Integration API** under `/api/v1/integration/` form a narrow,
versioned contract for external systems. Prefer these over staff ticket routes
when building sync jobs.

Case types (sagstyper): `incident`, `service_request`, `problem` — see
`GET /api/v1/integration/case-types`.

External ticket lookup: `ext:{system}:{external_id}` on
`GET|PATCH /api/v1/integration/tickets/{ticket_ref}`.
"""


def build_openapi_schema(app: FastAPI) -> dict[str, Any]:
    if app.openapi_schema:
        return app.openapi_schema

    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=OPENAPI_DESCRIPTION,
        routes=app.routes,
    )
    schema["servers"] = [
        {"url": settings.frontend_url.split(",")[0].strip(), "description": "Web (proxy)"},
        {"url": "/", "description": "API host root"},
    ]
    components = schema.setdefault("components", {})
    security_schemes = components.setdefault("securitySchemes", {})
    security_schemes["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Staff JWT from POST /api/v1/auth/login",
    }
    security_schemes["IntegrationApiKey"] = {
        "type": "apiKey",
        "in": "header",
        "name": "X-Integration-Key",
        "description": "Machine integration key (INTEGRATION_API_KEY)",
    }
    security_schemes["WebhookSecret"] = {
        "type": "apiKey",
        "in": "header",
        "name": "X-Webhook-Secret",
        "description": "Inbound webhook shared secret",
    }
    security_schemes["CronSecret"] = {
        "type": "http",
        "scheme": "bearer",
        "description": "Cron shared secret as Bearer token",
    }

    integration_paths = [
        path
        for path in schema.get("paths", {})
        if path.startswith("/api/v1/integration")
    ]
    for path in integration_paths:
        for operation in schema["paths"][path].values():
            if not isinstance(operation, dict):
                continue
            operation.setdefault("security", [{"IntegrationApiKey": []}])

    app.openapi_schema = schema
    return schema


def configure_openapi(app: FastAPI) -> None:
    app.openapi = lambda: build_openapi_schema(app)  # type: ignore[method-assign]
