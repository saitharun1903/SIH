import contextvars
import logging
import sys
import time
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import event

# Context variables to track DB metrics per async request task
db_query_time_var: contextvars.ContextVar[float] = contextvars.ContextVar("db_query_time", default=0.0)
db_query_count_var: contextvars.ContextVar[int] = contextvars.ContextVar("db_query_count", default=0)

# Configure logging format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger("nexus")


def register_db_timing_listener(engine):
    """Attach SQLAlchemy engine hooks to measure database execution time per request."""
    @event.listens_for(engine, "before_cursor_execute")
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        context._db_query_start = time.time()

    @event.listens_for(engine, "after_cursor_execute")
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        elapsed = time.time() - getattr(context, "_db_query_start", time.time())
        try:
            db_query_time_var.set(db_query_time_var.get() + elapsed)
            db_query_count_var.set(db_query_count_var.get() + 1)
        except Exception:
            pass


class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        # Reset DB metrics for this request context
        db_query_time_var.set(0.0)
        db_query_count_var.set(0)

        start_time = time.time()
        client_host = request.client.host if request.client else "unknown"
        path = request.url.path

        try:
            response = await call_next(request)
            total_duration_ms = round((time.time() - start_time) * 1000, 2)
            db_duration_ms = round(db_query_time_var.get() * 1000, 2)
            db_queries = db_query_count_var.get()

            logger.info(
                f"[{request_id}] {request.method} {path} - {response.status_code} "
                f"(Total: {total_duration_ms}ms, DB: {db_duration_ms}ms [{db_queries} queries]) from {client_host}"
            )
            response.headers["X-Request-ID"] = request_id
            response.headers["Server-Timing"] = f"total;dur={total_duration_ms}, db;dur={db_duration_ms}"
            return response
        except Exception as exc:
            total_duration_ms = round((time.time() - start_time) * 1000, 2)
            db_duration_ms = round(db_query_time_var.get() * 1000, 2)
            logger.error(
                f"[{request_id}] {request.method} {path} - FAILED "
                f"(Total: {total_duration_ms}ms, DB: {db_duration_ms}ms): {str(exc)}",
                exc_info=True,
            )
            raise exc

