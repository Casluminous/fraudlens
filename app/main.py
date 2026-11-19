from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.config import BASE_DIR, settings
from app.db import SessionLocal, engine, init_db
from app.ml.service import metadata
from app.routers import audit, auth, cases, dashboard, rules, transactions, users
from app.routers import settings as settings_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("fraudlens")

FRONTEND_DIST = BASE_DIR / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.is_production:
        if settings.jwt_secret.startswith("dev-only"):
            logger.warning("JWT_SECRET đang dùng giá trị mặc định — hãy đổi trước khi vận hành thật")
        if not settings.cookie_secure:
            logger.warning("COOKIE_SECURE=false trong production — refresh cookie sẽ không được gắn Secure")
    init_db()
    if settings.seed_on_start:
        from app.seed import seed_demo_data, seed_summary

        with SessionLocal() as db:
            seed_demo_data(db)
            logger.info("Demo data ready: %s", seed_summary(db))
    try:
        logger.info("Model loaded: %s", metadata()["version"])
    except Exception as exc:  # pragma: no cover - chỉ log khi artifact lỗi
        logger.warning("Không tải được model: %s", exc)
    yield


app = FastAPI(
    title="FraudLens API",
    description="Hệ thống chấm điểm rủi ro giao dịch có AI giải thích cảnh báo.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(Exception)
async def unhandled_exception(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Có lỗi xảy ra, vui lòng thử lại."})


@app.get("/api/health", tags=["system"])
def health() -> dict:
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        model_meta = metadata()
        return {
            "status": "ok",
            "database": engine.dialect.name,
            "model": model_meta["version"],
            "model_auc": model_meta["auc"],
            "environment": settings.environment,
        }
    except Exception as exc:
        logger.error("Health check failed: %s", exc)
        return JSONResponse(status_code=503, content={"status": "degraded", "detail": str(exc)})


app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(cases.router, prefix="/api")
app.include_router(rules.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")

if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
def spa(full_path: str):
    if full_path.startswith("api"):
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(index)
    return JSONResponse(
        status_code=200,
        content={
            "service": "FraudLens API",
            "docs": "/api/docs",
            "note": "Frontend chưa build. Chạy npm run build trong thư mục frontend.",
        },
    )


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
