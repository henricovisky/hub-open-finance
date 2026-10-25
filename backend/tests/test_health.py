import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock
from app.api.deps import get_db_session
from app.main import app


@pytest.mark.asyncio
async def test_health_check_healthy(async_client: AsyncClient):
    """Testa o endpoint de healthcheck com banco saudável."""
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "healthy"


@pytest.mark.asyncio
async def test_health_check_unhealthy(async_client: AsyncClient):
    """Testa o endpoint de healthcheck quando a conexão com o banco falha."""
    mock_session = AsyncMock(spec=AsyncSession)
    mock_session.execute.side_effect = Exception("Connection lost")
    app.dependency_overrides[get_db_session] = lambda: mock_session

    try:
        response = await async_client.get("/api/v1/health")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "degraded"
        assert "error: Connection lost" in data["database"]
    finally:
        app.dependency_overrides.pop(get_db_session, None)


@pytest.mark.asyncio
async def test_frontend_index_served(async_client: AsyncClient):
    """Testa se a página raiz entrega o HTML do frontend PWA."""
    response = await async_client.get("/")
    assert response.status_code == 200
    assert "Hub Financeiro" in response.text
    assert "hubApp" in response.text
