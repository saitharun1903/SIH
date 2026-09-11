from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db
from app.core.config import settings

router = APIRouter()


@router.get("/health", summary="System Health & Connectivity Check")
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint to verify database connectivity and core services."""
    db_status = "connected"
    db_dialect = "unknown"

    try:
        db.execute(text("SELECT 1"))
        db_dialect = db.bind.dialect.name if db.bind else "unknown"
    except Exception as e:
        db_status = f"unreachable: {str(e)}"

    is_healthy = db_status == "connected"

    return {
        "status": "healthy" if is_healthy else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "database": {
            "status": db_status,
            "dialect": db_dialect,
        },
        "version": "1.0.0",
    }
