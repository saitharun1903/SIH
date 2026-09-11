from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.logging import StructuredLoggingMiddleware, logger
from app.api.v1.router import api_router
from app.db.base import Base
from app.db.session import engine
from app.db.init_db import init_initial_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables and default demo users exist
    logger.info("Initializing database tables and seed baseline...")
    Base.metadata.create_all(bind=engine)
    init_initial_data()
    logger.info("NEXUS backend initialized and ready.")
    yield
    # Shutdown
    logger.info("NEXUS backend shutting down.")


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Powered Resource Intelligence, Optimization & Decision Automation Platform (SIH26202)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Structured Request Logging Middleware
app.add_middleware(StructuredLoggingMiddleware)

# Cross-Origin Resource Sharing (CORS) Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global Exception Handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
                "path": request.url.path,
            },
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "The submitted payload failed schema validation.",
                "details": jsonable_encoder(exc.errors()),
                "path": request.url.path,
            },
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected internal server error occurred. Please contact system support.",
                "path": request.url.path,
            },
        },
    )


# Register API Router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root():
    return {
        "app": settings.APP_NAME,
        "tagline": "AI-Powered Resource Intelligence, Optimization & Decision Automation Platform",
        "competition": "Smart India Hackathon 2026",
        "problem_statement": "SIH26202",
        "status": "online",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR,
    }


@app.get("/health", tags=["Root"], summary="Production Health Probe")
def root_health():
    """Safe production health check probe returning non-sensitive status."""
    return {"status": "healthy"}
