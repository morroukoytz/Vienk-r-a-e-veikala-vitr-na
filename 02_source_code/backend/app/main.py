"""
Entry point of the backend API (FastAPI).

Start locally:  uvicorn app.main:app --reload
In Docker the same command is used (see Dockerfile).

Responsibilities of this file:
  1. create the FastAPI application;
  2. configure CORS (which browser origins may call the API);
  3. connect all route groups under the "/api" prefix;
  4. turn errors into clear JSON messages WITHOUT leaking stack traces.
"""
import logging
import os
import time
from contextlib import asynccontextmanager

import psycopg
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.auth import ensure_demo_passwords
from app.db import get_connection
from app.routes import admin, auth_routes, dashboard, orders, products

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Code that runs once when the server starts."""
    # Refuse to start without a proper secret key (it signs the login tokens)
    if len(os.environ.get("SECRET_KEY", "")) < 16:
        raise RuntimeError("SECRET_KEY environment variable is missing or too short")

    # The database may need a few seconds to start, so we retry.
    for attempt in range(1, 11):
        try:
            ensure_demo_passwords()
            logger.info("Database is ready")
            break
        except psycopg.OperationalError:
            logger.warning("Database is not ready yet (attempt %s/10), retrying...", attempt)
            time.sleep(2)
    yield


app = FastAPI(
    title="Simple E-commerce Catalogue API",
    version="1.0.0",
    lifespan=lifespan,
    # Interactive documentation is available at /api/docs
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)

# ---------------------------------------------------------------------------
# CORS: list of allowed origins comes from the environment (.env)
# ---------------------------------------------------------------------------
allowed_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError):
    """Return validation errors as a simple list: [{field, message}, ...]."""
    errors = []
    for error in exc.errors():
        if error["type"] == "json_invalid":
            errors.append({"field": "request", "message": "The request body is not valid JSON."})
            continue
        # "loc" looks like ("body", "price") -> we keep only the field part
        field = ".".join(str(part) for part in error["loc"] if part not in ("body", "query", "path"))
        message = error["msg"].removeprefix("Value error, ")
        errors.append({"field": field or "request", "message": message})
    return JSONResponse(status_code=422, content={"detail": "Please correct the highlighted fields.", "errors": errors})


@app.exception_handler(psycopg.errors.IntegrityError)
async def integrity_error_handler(_request: Request, exc: psycopg.errors.IntegrityError):
    """Database rule was broken (e.g. duplicate unique value)."""
    logger.warning("Integrity error: %s", exc.diag.message_primary)
    return JSONResponse(status_code=409, content={"detail": "This change conflicts with existing data."})


@app.exception_handler(Exception)
async def unexpected_error_handler(_request: Request, exc: Exception):
    """Any other error: log the details on the server, show a neutral message to the user."""
    logger.exception("Unexpected error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error. Please try again later."})


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/api/health", tags=["health"])
def health_check():
    """Simple check that the API and the database are working."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT 1 AS ok")
        cur.fetchone()
    return {"status": "ok", "database": "connected"}


app.include_router(auth_routes.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
