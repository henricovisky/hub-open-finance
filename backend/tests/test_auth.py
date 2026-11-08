import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_success(async_client: AsyncClient, create_test_users):
    """Testa login bem-sucedido retornando access_token e refresh_token."""
    payload = {
        "email": "admin@test.com",
        "password": "AdminPass123!",
        "device_label": "Firefox Test",
    }
    response = await async_client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in_seconds"] == 900  # 15 min

    # Valida cookies HttpOnly
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies


@pytest.mark.asyncio
async def test_login_invalid_credentials(async_client: AsyncClient, create_test_users):
    """Testa login com senha incorreta."""
    payload = {
        "email": "admin@test.com",
        "password": "WrongPassword!",
    }
    response = await async_client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert "Email ou senha incorretos" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_inactive_user(async_client: AsyncClient, create_test_users):
    """Testa login de usuário inativo (deve ser rejeitado)."""
    payload = {
        "email": "inactive@test.com",
        "password": "InactivePass123!",
    }
    response = await async_client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_me_authenticated(async_client: AsyncClient, create_test_users):
    """Testa rota /auth/me com token Bearer válido."""
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "AdminPass123!"},
    )
    token = login_resp.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}
    me_resp = await async_client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200

    user_data = me_resp.json()
    assert user_data["email"] == "admin@test.com"
    assert user_data["name"] == "Admin Teste"
    assert user_data["role"] == "ADMIN"


@pytest.mark.asyncio
async def test_get_me_unauthenticated(async_client: AsyncClient):
    """Testa rota /auth/me sem autenticação (retorna 401)."""
    async_client.cookies.clear()
    response = await async_client.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_rotation(async_client: AsyncClient, create_test_users):
    """Valida rotação de refresh token: antigo é revogado e não pode ser reutilizado."""
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "member@test.com", "password": "MemberPass123!"},
    )
    old_refresh = login_resp.json()["refresh_token"]

    # 1. Rotaciona com sucesso
    refresh_resp = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert refresh_resp.status_code == 200
    new_data = refresh_resp.json()
    new_refresh = new_data["refresh_token"]
    assert new_refresh != old_refresh

    # 2. Tentar reutilizar o token antigo deve falhar (401)
    reuse_resp = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert reuse_resp.status_code == 401

    # 3. Novo token funciona perfeitamente
    valid_resp = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": new_refresh},
    )
    assert valid_resp.status_code == 200


@pytest.mark.asyncio
async def test_logout_revokes_session(async_client: AsyncClient, create_test_users):
    """Testa se o logout revoga a sessão."""
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "AdminPass123!"},
    )
    refresh_token = login_resp.json()["refresh_token"]

    logout_resp = await async_client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_token},
    )
    assert logout_resp.status_code == 200

    # Tentar refresh após logout deve falhar
    refresh_resp = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_resp.status_code == 401


@pytest.mark.asyncio
async def test_rbac_admin_allowed_and_member_forbidden(async_client: AsyncClient, create_test_users):
    """
    Testa controle de acesso RBAC estrito:
    - ADMIN pode acessar rotas administrativas (/admin/system-status)
    - MEMBER recebe 403 Forbidden
    - Sem autenticação recebe 401 Unauthorized
    """
    # 1. ADMIN acessa com sucesso (200)
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "AdminPass123!"},
    )
    admin_token = admin_login.json()["access_token"]
    admin_resp = await async_client.get(
        "/api/v1/admin/system-status",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_resp.status_code == 200
    assert admin_resp.json()["status"] == "operational"

    # 2. MEMBER recebe 403 Forbidden
    member_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "member@test.com", "password": "MemberPass123!"},
    )
    member_token = member_login.json()["access_token"]
    member_resp = await async_client.get(
        "/api/v1/admin/system-status",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert member_resp.status_code == 403
    assert "Acesso restrito ao perfil Administrador" in member_resp.json()["detail"]

    # 3. Limpa cookies e tenta acesso anônimo (recebe 401 Unauthorized)
    async_client.cookies.clear()
    anon_resp = await async_client.get("/api/v1/admin/system-status")
    assert anon_resp.status_code == 401
