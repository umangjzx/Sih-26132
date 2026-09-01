import logging
from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config as AlembicConfig
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.prices import router as prices_router
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

# No auth / cookies / JWT until Phase 2 — credentials and the method list
# widen again when auth lands.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(prices_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
