import pytest
import respx
from httpx import AsyncClient, Response


@pytest.mark.asyncio
async def test_connect_token_admin_allowed_member_forbidden(async_client: AsyncClient, create_test_users):
    """Valida que apenas o perfil ADMIN consegue gerar o Connect Token."""
    # 1. Login ADMIN
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "AdminPass123!"},
    )
    admin_token = admin_login.json()["access_token"]

    with respx.mock(base_url="https://api.pluggy.ai", assert_all_called=False) as respx_mock:
        respx_mock.post("/auth").respond(200, json={"apiKey": "mock-api-key"})
        respx_mock.post("/connect_token").respond(200, json={"accessToken": "mock-connect-token-xyz"})

        resp = await async_client.post(
            "/api/v1/connections/connect-token",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["connect_token"] == "mock-connect-token-xyz"
        assert resp.json()["expires_in_seconds"] == 1800

    # 2. Login MEMBER
    async_client.cookies.clear()
    member_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "member@test.com", "password": "MemberPass123!"},
    )
    member_token = member_login.json()["access_token"]

    resp_member = await async_client.post(
        "/api/v1/connections/connect-token",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp_member.status_code == 403


@pytest.mark.asyncio
async def test_complete_connection_workflow(async_client: AsyncClient, create_test_users):
    """Valida o registro de uma conexão após o callback do widget."""
    async_client.cookies.clear()
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "AdminPass123!"},
    )
    admin_token = admin_login.json()["access_token"]

    item_id = "test-item-uuid-123"

    with respx.mock(base_url="https://api.pluggy.ai", assert_all_called=False) as respx_mock:
        respx_mock.post("/auth").respond(200, json={"apiKey": "mock-api-key"})
        respx_mock.get(f"/items/{item_id}").respond(
            200,
            json={
                "id": item_id,
                "status": "UPDATED",
                "connector": {
                    "id": 2,
                    "name": "Pluggy Bank Sandbox",
                },
                "statusDetail": None,
                "createdAt": "2026-10-25T12:00:00Z",
            },
        )

        # 1. Complete
        resp = await async_client.post(
            "/api/v1/connections/complete",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"item_id": item_id},
        )
        assert resp.status_code == 201
        data = resp.json()
        conn_id = data["id"]
        assert data["pluggy_item_id"] == item_id
        assert data["institution_name"] == "Pluggy Bank Sandbox"
        assert data["status"] == "CONNECTED"

        # 2. List connections
        list_resp = await async_client.get(
            "/api/v1/connections",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert list_resp.status_code == 200
        conns = list_resp.json()
        assert len(conns) == 1
        assert conns[0]["id"] == conn_id

        # 3. Get connection detail with sync runs
        detail_resp = await async_client.get(
            f"/api/v1/connections/{conn_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        assert detail["id"] == conn_id
        assert len(detail["sync_runs"]) == 1
        assert detail["sync_runs"][0]["trigger"] == "INITIAL"


@pytest.mark.asyncio
async def test_reconnect_and_delete_connection(async_client: AsyncClient, create_test_users):
    """Valida a emissão de token para reconexão e a exclusão da conexão."""
    async_client.cookies.clear()
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "AdminPass123!"},
    )
    admin_token = admin_login.json()["access_token"]
    item_id = "test-reconnect-item-456"

    with respx.mock(base_url="https://api.pluggy.ai", assert_all_called=False) as respx_mock:
        respx_mock.post("/auth").respond(200, json={"apiKey": "mock-api-key"})
        respx_mock.get(f"/items/{item_id}").respond(
            200,
            json={
                "id": item_id,
                "status": "OUTDATED",
                "connector": {"id": 2, "name": "Pluggy Bank"},
            },
        )
        respx_mock.post("/connect_token").respond(200, json={"accessToken": "reconnect-token-abc"})
        respx_mock.delete(f"/items/{item_id}").respond(200, json={})

        # Cria conexão inicial
        complete_resp = await async_client.post(
            "/api/v1/connections/complete",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"item_id": item_id},
        )
        assert complete_resp.status_code == 201
        conn_id = complete_resp.json()["id"]

        # Solicita reconnect-token
        reconnect_resp = await async_client.post(
            f"/api/v1/connections/{conn_id}/reconnect-token",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert reconnect_resp.status_code == 200
        assert reconnect_resp.json()["connect_token"] == "reconnect-token-abc"

        # Exclui conexão
        del_resp = await async_client.delete(
            f"/api/v1/connections/{conn_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert del_resp.status_code == 200

        # Não deve mais aparecer na lista ativa
        list_resp = await async_client.get(
            "/api/v1/connections",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert len(list_resp.json()) == 0
