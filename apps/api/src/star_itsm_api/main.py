import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from star_itsm_api.core.config import settings
from star_itsm_api.core.openapi import configure_openapi
from star_itsm_api.core.startup_checks import validate_production_settings
from star_itsm_api.db import engine
from star_itsm_api.db_schema_sync import (
    ensure_kundeportal_2_role_current,
    ensure_login_throttle_schema_current,
    ensure_personal_notes_schema_current,
    ensure_prototype_staff_accounts_current,
    ensure_review_note_screenshot_schema_current,
    ensure_team_chat_schema_current,
    ensure_ticket_schema_current,
    ensure_workspace_layout_schema_current,
)
from star_itsm_api.middleware.security_headers import SecurityHeadersMiddleware
from star_itsm_api.routers import (
    admin,
    assets,
    auth,
    categories,
    chat,
    cron,
    gmail,
    health,
    integration_api,
    integrations,
    kanban,
    knowledge_articles,
    mcp,
    personal,
    platform,
    recurring_tasks,
    reports,
    review_notes,
    sf_chat,
    slack,
    sub_causes,
    tags,
    team_chat,
    teams,
    tickets,
    users,
    webhooks,
    workboard,
    workspace,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    validate_production_settings()
    if not settings.database_url:
        logger.warning(
            "DATABASE_URL is not set — API starts without DB; data endpoints return 503."
        )
    else:
        # Lightweight idempotent sync for personal_notes only (staging often skips Alembic).
        await ensure_login_throttle_schema_current(engine, settings.database_url)
        await ensure_personal_notes_schema_current(engine, settings.database_url)
        await ensure_kundeportal_2_role_current(engine, settings.database_url)
        await ensure_prototype_staff_accounts_current(engine, settings.database_url)
        await ensure_ticket_schema_current(engine, settings.database_url)
        await ensure_team_chat_schema_current(engine, settings.database_url)
        await ensure_workspace_layout_schema_current(engine, settings.database_url)
        await ensure_review_note_screenshot_schema_current(engine, settings.database_url)
    yield


app = FastAPI(
    title="STARdesk API",
    version="0.2.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)
configure_openapi(app)
app.add_middleware(SecurityHeadersMiddleware)
# Cursor / VS Code canvases: Origin null, vscode-webview://, vscode-file://, https://*.cursor.com
_canvas_cors_origins = ["null"]
_canvas_cors_origin_regex = (
    r"https://.*\.vercel\.app"
    r"|https://([a-z0-9-]+\.)*cursor\.(com|sh)"
    r"|http://localhost:\d+"
    r"|http://127\.0\.0\.1:\d+"
    r"|vscode-file://.*"
    r"|vscode-webview://.*"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[*settings.cors_origins, *_canvas_cors_origins],
    allow_origin_regex=_canvas_cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
API_V1_PREFIX = "/api/v1"

app.include_router(health.router)
app.include_router(auth.router, prefix=API_V1_PREFIX)
app.include_router(tickets.router, prefix=API_V1_PREFIX)
app.include_router(slack.router, prefix=API_V1_PREFIX)
app.include_router(gmail.router, prefix=API_V1_PREFIX)
app.include_router(integrations.router, prefix=API_V1_PREFIX)
app.include_router(integration_api.router, prefix=API_V1_PREFIX)
app.include_router(knowledge_articles.router, prefix=API_V1_PREFIX)
app.include_router(teams.router, prefix=API_V1_PREFIX)
app.include_router(kanban.router, prefix=API_V1_PREFIX)
app.include_router(personal.router, prefix=API_V1_PREFIX)
app.include_router(workboard.router, prefix=API_V1_PREFIX)
app.include_router(review_notes.router, prefix=API_V1_PREFIX)
app.include_router(categories.router, prefix=API_V1_PREFIX)
app.include_router(tags.router, prefix=API_V1_PREFIX)
app.include_router(assets.router, prefix=API_V1_PREFIX)
app.include_router(sub_causes.router, prefix=API_V1_PREFIX)
app.include_router(webhooks.router, prefix=API_V1_PREFIX)
app.include_router(cron.router, prefix=API_V1_PREFIX)
app.include_router(reports.router, prefix=API_V1_PREFIX)
app.include_router(recurring_tasks.router, prefix=API_V1_PREFIX)
app.include_router(users.router, prefix=API_V1_PREFIX)
app.include_router(platform.router, prefix=API_V1_PREFIX)
app.include_router(admin.router, prefix=API_V1_PREFIX)
app.include_router(sf_chat.router, prefix=API_V1_PREFIX)
app.include_router(mcp.router, prefix=API_V1_PREFIX)
app.include_router(chat.router, prefix=API_V1_PREFIX)
app.include_router(team_chat.router, prefix=API_V1_PREFIX)
app.include_router(workspace.router, prefix=API_V1_PREFIX)
