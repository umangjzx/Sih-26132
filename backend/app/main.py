import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path

from alembic import command
from alembic.config import Config as AlembicConfig
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError

from app.api.admin import router as admin_router
from app.api.alerts import router as alerts_router
from app.api.auth import router as auth_router
from app.api.deals import router as deals_router
from app.api.demands import router as demands_router
from app.api.disputes import router as disputes_router
from app.api.financing import router as financing_router
from app.api.history import router as history_router
from app.api.intel import router as intel_router
from app.api.assistant import router as assistant_router
from app.api.ocr import router as ocr_router
from app.api.pools import router as pools_router
from app.api.location import router as location_router
from app.api.lots import router as lots_router
from app.api.matching import router as matching_router
from app.api.offers import router as offers_router
from app.api.prices import router as prices_router
from app.api.public import router as public_router
from app.api.forward import router as forward_router
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
    except Exception:  # noqa: BLE001 — a failed cycle must not bubble out of the scheduler
        logger.exception("Scheduled ingestion job failed; will retry next interval")
    finally:
        db.close()


def _run_sms_digest_job() -> None:
    from app.services.digest import send_sms_digests

    db = SessionLocal()
    try:
        n = send_sms_digests(db)
        if n:
            logger.info("SMS digest job sent %d digest(s)", n)
    except Exception:  # noqa: BLE001 — a failed cycle must not bubble out of the scheduler
        logger.exception("Scheduled SMS digest job failed; will retry next interval")
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
            # First boot on an empty DB — block so the app never serves nothing.
            result = ingestion.run_ingestion(db)
            logger.info("Initial ingestion: %s", result)
        # Idempotent: seeds the curated transporter directory once.
        try:
            from app.services.transporters import seed_transporters

            n = seed_transporters(db)
            if n:
                logger.info("Seeded %d transporters", n)
        except Exception:  # noqa: BLE001 — never block boot on the directory seed
            logger.exception("transporter seed failed")
    finally:
        db.close()

    scheduler.add_job(
        _run_ingestion_job, "interval", hours=6,
        id="price_ingestion", replace_existing=True, max_instances=1, coalesce=True,
    )
    # Always refresh shortly after boot too, so a restart pulls the latest day
    # (and today's rows accumulate into history via the upsert key).
    scheduler.add_job(
        _run_ingestion_job, "date",
        run_date=datetime.now() + timedelta(seconds=20),
        id="price_ingestion_boot", replace_existing=True,
    )
    # Once a day, not every ingestion cycle — an opted-in user gets at most
    # one text per _DIGEST_COOLDOWN regardless of how often this fires, but
    # there's no reason to check more often than a day for an SMS digest.
    scheduler.add_job(
        _run_sms_digest_job, "interval", hours=24,
        id="sms_digest", replace_existing=True, max_instances=1, coalesce=True,
    )
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

@app.middleware("http")
async def timing_log(request: Request, call_next):
    """Minimal request-timing observability — this app has no tracing/APM
    (deliberately, for a single-VM deployment this size), so without this
    there was no way to answer "where did the time go" for a slow request
    short of re-instrumenting and reproducing it. Logs only the slow tail
    (>1s) so this doesn't itself become per-request overhead/log noise."""
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - start) * 1000
    if duration_ms > 1000:
        logger.warning("SLOW %s %s took %.0fms", request.method, request.url.path, duration_ms)
    return response


@app.exception_handler(OperationalError)
async def db_operational_error_handler(request: Request, exc: OperationalError) -> JSONResponse:
    """Two concurrent requests updating overlapping rows in different orders
    (e.g. accept_offer's Offer->Lot updates racing withdraw_lot's Lot->Match
    updates) can genuinely deadlock — Postgres detects the cycle and aborts
    one side. That's expected under real concurrency, not a bug in either
    transaction's own logic, so surface it as the same "just try again" 409
    every other race in this app already returns instead of a raw 500.
    Any other OperationalError (e.g. the DB connection itself dropping)
    still surfaces as a 500 — this only special-cases the deadlock code.
    """
    pgcode = getattr(getattr(exc, "orig", None), "pgcode", None)
    if pgcode == "40P01":  # PostgreSQL deadlock_detected
        logger.warning("DB deadlock on %s %s — returning 409", request.method, request.url.path)
        return JSONResponse(
            status_code=409,
            content={"detail": "This action conflicted with another update — please try again."},
        )
    logger.exception("Unhandled DB OperationalError on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


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
app.include_router(location_router)
app.include_router(assistant_router)
app.include_router(ocr_router)
app.include_router(pools_router)
app.include_router(prices_router)
app.include_router(forward_router)
app.include_router(financing_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
