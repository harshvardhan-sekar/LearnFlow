"""Shared test fixtures — async SQLite DB + mocked auth."""

import pytest
import pytest_asyncio
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from models.database import Base, get_db


# Map PostgreSQL JSONB → TEXT for SQLite so create_all works in tests.
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(element, compiler, **kw):
    return "JSON"
from models.user import User
from models.session import Session
from models.topic import LearningTopic
from utils.dependencies import get_current_user


# ── Engine / session factory for tests ───────────────────────────────────

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


# ── Fixtures ─────────────────────────────────────────────────────────────


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Create all tables before each test, drop after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db():
    """Provide a fresh async DB session."""
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def test_user(db: AsyncSession) -> User:
    """Insert a test user and return it."""
    user = User(
        firebase_uid="test-uid-123",
        email="test@example.com",
        display_name="Test User",
        role="participant",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_topic(db: AsyncSession, test_user: User) -> LearningTopic:
    """Insert a test learning topic."""
    topic = LearningTopic(
        title="Introduction to Machine Learning",
        description="Learn the fundamentals of ML",
        created_by=test_user.id,
    )
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


@pytest_asyncio.fixture
async def test_session(db: AsyncSession, test_user: User, test_topic: LearningTopic) -> Session:
    """Insert an active session."""
    session = Session(
        user_id=test_user.id,
        topic_id=test_topic.id,
        status="active",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@pytest_asyncio.fixture
async def client(db: AsyncSession, test_user: User):
    """Build an httpx.AsyncClient wired to the FastAPI app with overridden deps."""
    from httpx import ASGITransport, AsyncClient
    from main import app

    async def _override_get_db():
        yield db

    async def _override_get_current_user():
        return test_user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()
