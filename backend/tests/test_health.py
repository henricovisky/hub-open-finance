import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check_healthy(async_client: AsyncClient):
    """Testa o endpoint de healthcheck com banco saudável."""
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "healthy"


@pytest.mark.asyncio
async def test_health_check_unhealthy(async_client: AsyncClient, mock_db_session):
    """Testa o endpoint de healthcheck quando a conexão com o banco falha."""
    mock_db_session.execute.side_effect = Exception("Connection lost")
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "degraded"
    assert "error: Connection lost" in data["database"]
