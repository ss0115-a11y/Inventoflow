from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, check_db_connection
# Import all models so Base.metadata knows about every table
import app.models  # noqa: F401
from app.database import Base

from app.routers import (
    auth_router,
    categories_router,
    products_router,
    stock_router,
    sales_router,
    dashboard_router,
    export_router,
    users_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Attempt to create tables; log a warning if DB is not yet reachable.
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        print(f"[WARN] Could not create tables on startup: {exc}")
    yield


app = FastAPI(
    title="Smart Inventory & Sales Dashboard API",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API routers under /api
app.include_router(auth_router, prefix="/api")
app.include_router(categories_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(stock_router, prefix="/api")
app.include_router(sales_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(export_router, prefix="/api")
app.include_router(users_router, prefix="/api")


@app.get("/api/health", tags=["meta"])
def health_check():
    db_ok = check_db_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
    }
