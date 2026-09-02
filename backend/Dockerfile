# AgriLink backend — FastAPI + APScheduler, single Uvicorn worker on purpose.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# psycopg2-binary ships wheels — no system build deps needed.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code, alembic.ini + alembic/ (the lifespan runs `alembic upgrade head`
# from the working dir on startup), and scripts/ (demo-user seeding).
COPY . .

EXPOSE 8000

# One worker: the price-ingestion + alert-eval scheduler runs in-process, so a
# second worker would double every scheduled job. --proxy-headers because Caddy
# terminates TLS in front of this.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips=*"]
