"""Shared pytest fixtures for the backend suite.

The DB fixtures use SQLite in-memory with a ``StaticPool`` so every session in a
test shares one connection (schema created once, visible everywhere). The
``client`` fixture yields a **bare** ``TestClient(app)`` — never the ``with``
form — because the context manager runs the real FastAPI lifespan, which boots
APScheduler and triggers ``alembic upgrade`` / live ingestion (Pitfall 4).

Phase 2 additions:
  - ``farmer_user`` / ``buyer_user``: insert User rows for role-gated tests.
  - ``farmer_client`` / ``buyer_client``: override ``get_current_user`` dep so
    every request is already authenticated as the given user.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_current_user
from app.main import app
from app.models.price_cache import PriceCache
from app.models.user import User
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


# ---------------------------------------------------------------------------
# Phase 2: user fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def farmer_user(db):
    """A persisted farmer User for use in authenticated tests."""
    user = User(
        role="farmer",
        name="Ravi Patil",
        phone="+910000000001",
        district="Pune",
        taluka="Haveli",
        kyc_status="unverified",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def buyer_user(db):
    """A persisted buyer User (kyc_status=verified) for use in authenticated tests."""
    user = User(
        role="buyer",
        name="Anil Traders",
        phone="+910000000002",
        district="Nashik",
        taluka="Nashik",
        kyc_status="verified",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def farmer_client(farmer_user, db):
    """TestClient pre-authenticated as the farmer_user.

    Overrides both ``get_db`` (SQLite) and ``get_current_user`` (returns the
    farmer without touching the Authorization header).
    """
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: farmer_user
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def buyer_client(buyer_user, db):
    """TestClient pre-authenticated as the buyer_user."""
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: buyer_user
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_client(db):
    """TestClient with only get_db overridden (no user injected).

    Use when the test controls authentication manually via tokens.
    """
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()
