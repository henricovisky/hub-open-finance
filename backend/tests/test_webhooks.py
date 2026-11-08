import pytest
import respx
from httpx import AsyncClient, Response
from app.core.config import settings
from app.models.connection import ConnectionStatus, FinancialConnection
from app.models.webhook import WebhookEvent, WebhookEventStatus
from app.services.webhook_service import WebhookService


@pytest.mark.asyncio
async def test_webhook_secret_validation(async_client: AsyncClient, test_db_session):
    """Valida que o webhook rejeita requisições sem o segredo correto configurado."""
    orig_secret = settings.PLUGGY_WEBHOOK_SECRET
    settings.PLUGGY_WEBHOOK_SECRET = "test_custom_webhook_secret_abc"

    try:
        payload = {"event": "item/updated", "id": "evt-unauth-1", "itemId": "item-1"}

        # 1. Sem cabeçalho -> 401
        resp_no_header = await async_client.post("/api/v1/webhooks/pluggy", json=payload)
        assert resp_no_header.status_code == 401

        # 2. Cabeçalho errado -> 401
        headers_wrong = {"X-Pluggy-Webhook-Secret": "wrong_secret"}
        resp_wrong = await async_client.post("/api/v1/webhooks/pluggy", json=payload, headers=headers_wrong)
        assert resp_wrong.status_code == 401

        # 3. Cabeçalho correto -> 202
        headers_correct = {"X-Pluggy-Webhook-Secret": "test_custom_webhook_secret_abc"}
        resp_ok = await async_client.post("/api/v1/webhooks/pluggy", json=payload, headers=headers_correct)
        assert resp_ok.status_code == 202
        assert resp_ok.json()["status"] == "received"
        assert resp_ok.json()["is_duplicate"] is False

    finally:
        settings.PLUGGY_WEBHOOK_SECRET = orig_secret


@pytest.mark.asyncio
async def test_webhook_idempotency_duplicate_events(async_client: AsyncClient, test_db_session):
    """Valida idempotência: o envio do mesmo eventId duas vezes não duplica processamento."""
    payload = {
        "event": "item/updated",
        "id": "evt-duplicate-test-999",
        "itemId": "item-abc",
    }

    # 1. Primeira chamada -> gravado como novo
    resp1 = await async_client.post("/api/v1/webhooks/pluggy", json=payload)
    assert resp1.status_code == 202
    assert resp1.json()["is_duplicate"] is False

    # 2. Segunda chamada com o mesmo ID -> reconhecido como duplicata
    resp2 = await async_client.post("/api/v1/webhooks/pluggy", json=payload)
    assert resp2.status_code == 202
    assert resp2.json()["is_duplicate"] is True


@pytest.mark.asyncio
async def test_webhook_processing_dispatches_status_and_sync(async_client: AsyncClient, test_db_session, create_test_users):
    """Valida o despacho correto dos eventos e a atualização do estado da conexão."""
    admin_user = create_test_users["admin"]
    item_id = "test-webhook-conn-item"

    # Cria conexão ativa no banco
    conn = FinancialConnection(
        provider="PLUGGY",
        pluggy_item_id=item_id,
        owner_user_id=admin_user.id,
        institution_name="Pluggy Bank Test",
        connector_id=2,
        status=ConnectionStatus.CONNECTED,
    )
    test_db_session.add(conn)
    await test_db_session.commit()
    await test_db_session.refresh(conn)

    # 1. Evento de erro (item/error) deve mudar status da conexão para ATTENTION
    error_event, _ = await WebhookService.record_event(
        db=test_db_session,
        event_id="evt-error-101",
        event_type="item/error",
        item_id=item_id,
        payload={"event": "item/error", "itemId": item_id},
    )

    with respx.mock(base_url="https://api.pluggy.ai", assert_all_called=False) as respx_mock:
        respx_mock.post("/auth").respond(200, json={"apiKey": "mock-api-key"})

        # Executa processamento
        from app.core.pluggy import get_pluggy_auth_manager
        from app.integrations.pluggy import PluggyClient
        client = PluggyClient(client_id="id", client_secret="sec", auth_manager=get_pluggy_auth_manager())

        await WebhookService.process_event(test_db_session, client, error_event.event_id)
        await test_db_session.refresh(conn)
        assert conn.status == ConnectionStatus.ATTENTION
        assert error_event.status == WebhookEventStatus.PROCESSED

        # 2. Evento com item_id desconhecido deve ser marcado como IGNORED
        unknown_event, _ = await WebhookService.record_event(
            db=test_db_session,
            event_id="evt-unknown-999",
            event_type="item/updated",
            item_id="unknown-item-xyz",
            payload={"event": "item/updated", "itemId": "unknown-item-xyz"},
        )
        await WebhookService.process_event(test_db_session, client, unknown_event.event_id)
        assert unknown_event.status == WebhookEventStatus.IGNORED
