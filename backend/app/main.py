import logging
from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config as AlembicConfig
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin import router as admin_router
from app.api.alerts import router as alerts_router
from app.api.auth import router as auth_router
from app.api.deals import router as deals_router
from app.api.demands import router as demands_router
from app.api.disputes import router as disputes_router
from app.api.history import router as history_router
from app.api.intel import router as intel_router
from app.api.lots import router as lots_router
from app.api.matching import router as matching_router
from app.api.offers import router as offers_router
from app.api.prices import router as prices_router
from app.api.public import router as public_router
from app.core.config import settings
from app.core.database import SessionLocal
from app.services import ingestion

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def _run_ingestion_job() -> None:
    db = SessionLocal()
    try:
        result = ingestion.run_ingestion(db)
        logger.info("Ingestion job finished: %s", result)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Idempotent: a no-op when the schema is already at head. Manual fallback
    # (documented in backend/README.md): `cd backend && alembic upgrade head`.
    try:
        command.upgrade(AlembicConfig(str(ALEMBIC_INI)), "head")
    except Exception:
        logger.exception(
            "alembic upgrade failed - run 'cd backend && alembic upgrade head' manually"
        )
        raise

    db = SessionLocal()
    try:
        if not ingestion.has_price_data(db):
            result = ingestion.run_ingestion(db)
            logger.info("Initial ingestion: %s", result)
    finally:
        db.close()

    scheduler.add_job(_run_ingestion_job, "interval", hours=6, id="price_ingestion")
    scheduler.start()

    yield

    scheduler.shutdown(wait=False)


app = FastAPI(title="AgriLink API", lifespan=lifespan)

# Phase 2: auth landed — credentials enabled, methods widened.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(lots_router)
app.include_router(demands_router)
app.include_router(matching_router)
app.include_router(offers_router)
app.include_router(deals_router)
app.include_router(disputes_router)
app.include_router(history_router)
app.include_router(admin_router)
app.include_router(intel_router)
app.include_router(public_router)
app.include_router(alerts_router)
app.include_router(prices_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
