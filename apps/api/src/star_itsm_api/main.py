import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from star_itsm_api.core.config import settings
from star_itsm_api.core.startup_checks import validate_production_settings
from star_itsm_api.db import engine
from star_itsm_api.db_alembic import run_alembic_upgrade_head
from star_itsm_api.db_schema_sync import ensure_ticket_schema_current
from star_itsm_api.middleware.security_headers import SecurityHeadersMiddleware
from star_itsm_api.routers import (
    admin,
    assets,
    auth,
    categories,
    cron,
    gmail,
    health,
    integrations,
    kanban,
    knowledge_articles,
    platform,
    reports,
    sf_chat,
    slack,
    sub_causes,
    teams,
    tickets,
    users,
    webhooks,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    validate_production_settings()
    if not settings.database_url:
        logger.warning(
            "DATABASE_URL is not set — API starts without DB; "
            "data endpoints return 503."
        )
    else:
        await asyncio.to_thread(run_alembic_upgrade_head)
        await ensure_ticket_schema_current(engine, settings.database_url)
    yield


app = FastAPI(
    title="STARdesk API",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(tickets.router, prefix="/api/v1")
app.include_router(slack.router, prefix="/api/v1")
app.include_router(gmail.router, prefix="/api/v1")
app.include_router(integrations.router, prefix="/api/v1")
app.include_router(knowledge_articles.router, prefix="/api/v1")
app.include_router(teams.router, prefix="/api/v1")
app.include_router(kanban.router, prefix="/api/v1")
app.include_router(categories.router, prefix="/api/v1")
app.include_router(assets.router, prefix="/api/v1")
app.include_router(sub_causes.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")
app.include_router(cron.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(platform.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(sf_chat.router, prefix="/api/v1")
