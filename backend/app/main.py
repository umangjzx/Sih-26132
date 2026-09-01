import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.prices import router as prices_router
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.services import ingestion

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
    Base.metadata.create_all(bind=engine)

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prices_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
