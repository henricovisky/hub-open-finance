from typing import AsyncGenerator
from unittest.mock import AsyncMock
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.health import get_db_session
from app.main import app


@pytest.fixture
def mock_db_session():
    """Mock da sessão assíncrona do banco de dados para testes isolados."""
    session = AsyncMock(spec=AsyncSession)
    session.execute.return_value = AsyncMock()
    return session


@pytest_asyncio.fixture
async def async_client(mock_db_session) -> AsyncGenerator[AsyncClient, None]:
    """Cliente HTTP assíncrono para testar endpoints FastAPI."""
    app.dependency_overrides[get_db_session] = lambda: mock_db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()
