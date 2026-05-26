from collections.abc import AsyncGenerator
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from star_itsm_api.core.config import settings

engine: AsyncEngine | None = None
async_session_factory: async_sessionmaker[AsyncSession] | None = None


def normalize_database_url(url: str) -> str:
    """Use an async SQLAlchemy URL and strip query params asyncpg does not accept."""
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url.removeprefix("postgresql://")
    elif url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url.removeprefix("postgres://")

    parsed = urlparse(url)
    if not parsed.query:
        return url
    filtered = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if key not in {"sslmode", "channel_binding"}
    ]
    return urlunparse(parsed._replace(query=urlencode(filtered)))


def _connect_args(url: str) -> dict[str, bool]:
    if "sslmode=require" in url or "ssl=require" in url or "neon.tech" in url:
        return {"ssl": True}
    return {}


if settings.database_url:
    _raw_url = settings.database_url
    _db_url = normalize_database_url(_raw_url)
    engine = create_async_engine(
        _db_url,
        echo=False,
        connect_args=_connect_args(_raw_url),
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=300,
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
