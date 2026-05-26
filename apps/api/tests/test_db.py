from star_itsm_api.db import normalize_database_url


def test_normalize_database_url_uses_asyncpg_driver() -> None:
    url = "postgresql://user:pass@example.neon.tech/neondb?sslmode=require"

    assert normalize_database_url(url) == "postgresql+asyncpg://user:pass@example.neon.tech/neondb"


def test_normalize_database_url_accepts_postgres_scheme() -> None:
    url = "postgres://user:pass@example.neon.tech/neondb?channel_binding=require"

    assert normalize_database_url(url) == "postgresql+asyncpg://user:pass@example.neon.tech/neondb"
