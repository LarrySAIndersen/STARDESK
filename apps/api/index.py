"""Vercel serverless entrypoint (re-exports FastAPI app)."""

from star_itsm_api.main import app

__all__ = ["app"]
