from typing import AsyncGenerator
from unittest.mock import AsyncMock
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.api.deps import get_db_session
from app.core.security import hash_password
from app.main import app
from app.models.base import Base, UserRole
from app.models.user import User

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def test_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Cria banco SQLite em memória com todas as tabelas para testes isolados."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def async_client(test_db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Cliente HTTP assíncrono conectado ao banco de teste."""
    app.dependency_overrides[get_db_session] = lambda: test_db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def create_test_users(test_db_session: AsyncSession):
    """Cria um usuário ADMIN e um usuário MEMBER no banco de testes."""
    admin = User(
        name="Admin Teste",
        email="admin@test.com",
        password_hash=hash_password("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    member = User(
        name="Membro Teste",
        email="member@test.com",
        password_hash=hash_password("MemberPass123!"),
        role=UserRole.MEMBER,
        is_active=True,
    )
    inactive = User(
        name="Inativo Teste",
        email="inactive@test.com",
        password_hash=hash_password("InactivePass123!"),
        role=UserRole.MEMBER,
        is_active=False,
    )
    test_db_session.add_all([admin, member, inactive])
    await test_db_session.commit()
    return {"admin": admin, "member": member, "inactive": inactive}
