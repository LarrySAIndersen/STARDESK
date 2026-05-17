import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from star_itsm_api.core.config import settings
from star_itsm_api.routers import auth, categories, cron, health, reports, sub_causes, teams, tickets, webhooks

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    if not settings.database_url:
        logger.warning(
            "DATABASE_URL is not set — API starts without DB; "
            "data endpoints return 503."
        )
    yield


app = FastAPI(
    title="STARdesk API",
    version="0.2.0",
    lifespan=lifespan,
)

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
app.include_router(teams.router, prefix="/api/v1")
app.include_router(categories.router, prefix="/api/v1")
app.include_router(sub_causes.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")
app.include_router(cron.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
