"""
NEXUS Backend - Top-level entrypoint
Exports FastAPI app for ASGI servers and Vercel Serverless / Services runtime.
"""
from app.main import app

__all__ = ["app"]
