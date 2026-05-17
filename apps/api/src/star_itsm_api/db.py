from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from star_itsm_api.core.config import settings

engine: AsyncEngine | None = None
async_session_factory: async_sessionmaker[AsyncSession] | None = None

def _connect_args() -> dict[str, bool]:
    url = settings.database_url or ""
    if "sslmode=require" in url or "ssl=require" in url:
        return {"ssl": True}
    return {}


if settings.database_url:
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        connect_args=_connect_args(),
    )
    async_session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


async def get_db() -> AsyncGenerator[AsyncSession | None, None]:
    if async_session_factory is None:
        yield None
        return
    async with async_session_factory() as session:
        yield session
