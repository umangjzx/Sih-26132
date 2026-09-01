"""Shared pytest fixtures for the backend suite.

The DB fixtures use SQLite in-memory with a ``StaticPool`` so every session in a
test shares one connection (schema created once, visible everywhere). The
``client`` fixture yields a **bare** ``TestClient(app)`` — never the ``with``
form — because the context manager runs the real FastAPI lifespan, which boots
APScheduler and triggers ``alembic upgrade`` / live ingestion (Pitfall 4).
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.models.price_cache import PriceCache
from app.services.fixtures import generate_fixture_rows


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture()
def seeded_db(db):
    db.add_all(PriceCache(**row) for row in generate_fixture_rows(days=40))
    db.commit()
    return db


@pytest.fixture()
def client(seeded_db):
    app.dependency_overrides[get_db] = lambda: seeded_db
    yield TestClient(app)  # no `with` — lifespan / scheduler never start
    app.dependency_overrides.clear()
