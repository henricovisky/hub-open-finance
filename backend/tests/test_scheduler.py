from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
import pytest
import respx
from httpx import AsyncClient, Response
from app.jobs.scheduler import get_scheduler_info, setup_scheduler
from app.jobs.tasks import run_scheduled_sync
from app.models.connection import ConnectionStatus, ConnectionSyncRun, FinancialConnection, SyncStatus, SyncTrigger


def test_scheduler_setup_and_jobs_registered():
    """Valida se o agendador registra as 5 tarefas principais e os horários corretos."""
    setup_scheduler()
    info = get_scheduler_info()

    job_ids = [j["id"] for j in info["jobs"]]
    assert "sync_morning_07_00" in job_ids
    assert "sync_afternoon_13_30" in job_ids
    assert "sync_night_20_30" in job_ids
    assert "reconciliation_daily_03_00" in job_ids
    assert "cleanup_weekly_sun_04_00" in job_ids


@pytest.mark.asyncio
async def test_admin_system_status_and_stale_detection(async_client: AsyncClient, test_db_session, create_test_users):
    """
    Testa o endpoint /admin/system-status:
    - Retorna diagnóstico de saúde e estado do agendador.
    - Sinaliza 'is_stale: True' quando a conexão nunca sincronizou ou tem última sincronização > 12h.
    - Bloqueia acesso de perfil MEMBER (403).
    """
    admin_user = create_test_users["admin"]

    # Cria duas conexões: uma recente e uma defasada (> 12h)
    now = datetime.now(timezone.utc)
    conn_fresh = FinancialConnection(
        provider="PLUGGY",
        pluggy_item_id="item-fresh-1",
        owner_user_id=admin_user.id,
        institution_name="Banco Recente",
        connector_id=2,
        status=ConnectionStatus.CONNECTED,
        last_successful_sync_at=now - timedelta(hours=2),
    )
    conn_stale = FinancialConnection(
        provider="PLUGGY",
        pluggy_item_id="item-stale-2",
        owner_user_id=admin_user.id,
        institution_name="Banco Defasado",
        connector_id=601,
        status=ConnectionStatus.CONNECTED,
        last_successful_sync_at=now - timedelta(hours=15),
    )
    test_db_session.add_all([conn_fresh, conn_stale])
    await test_db_session.commit()

    # 1. Login ADMIN
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "AdminPass123!"},
    )
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    resp = await async_client.get("/api/v1/admin/system-status", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "operational"
    assert data["total_connections"] == 2
    assert "scheduler" in data

    status_map = {c["institution_name"]: c["is_stale"] for c in data["connections"]}
    assert status_map["Banco Recente"] is False
    assert status_map["Banco Defasado"] is True

    # 2. Login MEMBER recebe 403 Forbidden
    async_client.cookies.clear()
    member_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "member@test.com", "password": "MemberPass123!"},
    )
    member_token = member_login.json()["access_token"]
    resp_member = await async_client.get(
        "/api/v1/admin/system-status",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp_member.status_code == 403


@pytest.mark.asyncio
async def test_admin_sync_runs_history_and_pagination(async_client: AsyncClient, test_db_session, create_test_users):
    """Testa a listagem paginada do histórico de sincronizações no endpoint /admin/sync-runs."""
    admin_user = create_test_users["admin"]

    conn = FinancialConnection(
        provider="PLUGGY",
        pluggy_item_id="item-runs-test",
        owner_user_id=admin_user.id,
        institution_name="Banco Teste Runs",
        connector_id=2,
        status=ConnectionStatus.CONNECTED,
    )
    test_db_session.add(conn)
    await test_db_session.flush()

    # Cria duas execuções no histórico
    run1 = ConnectionSyncRun(
        connection_id=conn.id,
        trigger=SyncTrigger.SCHEDULED,
        status=SyncStatus.SUCCESS,
        records_read=10,
        records_inserted=5,
        records_updated=5,
    )
    run2 = ConnectionSyncRun(
        connection_id=conn.id,
        trigger=SyncTrigger.WEBHOOK,
        status=SyncStatus.FAILED,
        error_code="TIMEOUT",
        error_message_safe="Timeout ao conectar",
    )
    test_db_session.add_all([run1, run2])
    await test_db_session.commit()

    # Login ADMIN
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "AdminPass123!"},
    )
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Consulta histórico
    runs_resp = await async_client.get("/api/v1/admin/sync-runs", headers=admin_headers)
    assert runs_resp.status_code == 200
    res_data = runs_resp.json()
    assert res_data["total"] == 2
    assert len(res_data["results"]) == 2

    # Filtro por status=FAILED
    failed_resp = await async_client.get("/api/v1/admin/sync-runs?run_status=FAILED", headers=admin_headers)
    assert failed_resp.status_code == 200
    assert failed_resp.json()["total"] == 1
    assert failed_resp.json()["results"][0]["status"] == "FAILED"
