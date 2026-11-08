import asyncio
from datetime import datetime
from decimal import Decimal
import pytest
import respx
from httpx import Response
from app.integrations.pluggy.auth import PluggyAuthManager
from app.integrations.pluggy.client import PluggyClient
from app.integrations.pluggy.exceptions import (
    PluggyAuthError,
    PluggyPermissionError,
    PluggyRateLimitError,
    PluggyServerError,
)
from app.integrations.pluggy.schemas import PluggyAccount, PluggyItem, PluggyTransaction


@pytest.mark.asyncio
async def test_auth_manager_cache():
    """Valida se a API Key é reutilizada do cache sem bater na Pluggy repetidamente."""
    auth = PluggyAuthManager(
        client_id="test_id",
        client_secret="test_secret",
        base_url="https://api.pluggy.ai",
        ttl_seconds=3600,
    )

    with respx.mock(base_url="https://api.pluggy.ai") as respx_mock:
        route = respx_mock.post("/auth").respond(200, json={"apiKey": "api-key-cached"})

        key1 = await auth.get_api_key()
        key2 = await auth.get_api_key()

        assert key1 == "api-key-cached"
        assert key2 == "api-key-cached"
        assert route.call_count == 1


@pytest.mark.asyncio
async def test_client_retry_on_401():
    """Valida se o cliente renova a API Key e tenta novamente ao receber 401."""
    auth = PluggyAuthManager(
        client_id="test_id",
        client_secret="test_secret",
        base_url="https://api.pluggy.ai",
    )

    with respx.mock(base_url="https://api.pluggy.ai") as respx_mock:
        auth_route = respx_mock.post("/auth").side_effect = [
            Response(200, json={"apiKey": "first-expired-key"}),
            Response(200, json={"apiKey": "second-renewed-key"}),
        ]

        items_route = respx_mock.get("/items/item-123").side_effect = [
            Response(401, json={"message": "Token expired"}),
            Response(200, json={"id": "item-123", "status": "UPDATED"}),
        ]

        async with PluggyClient(client_id="test_id", client_secret="test_secret", auth_manager=auth) as client:
            item = await client.items.get("item-123")
            assert item.id == "item-123"
            assert item.status == "UPDATED"


@pytest.mark.asyncio
async def test_client_403_no_retry():
    """Valida se 403 lança PluggyPermissionError imediatamente sem retry desnecessário."""
    auth = PluggyAuthManager(client_id="test_id", client_secret="test_secret")

    with respx.mock(base_url="https://api.pluggy.ai") as respx_mock:
        respx_mock.post("/auth").respond(200, json={"apiKey": "key-123"})
        respx_mock.get("/items/item-123").respond(403, json={"message": "Forbidden scope"})

        async with PluggyClient(client_id="test_id", client_secret="test_secret", auth_manager=auth) as client:
            with pytest.raises(PluggyPermissionError):
                await client.items.get("item-123")


@pytest.mark.asyncio
async def test_client_retry_on_5xx_with_recovery():
    """Valida se o cliente repete requisições com falha transitória de servidor (5xx)."""
    auth = PluggyAuthManager(client_id="test_id", client_secret="test_secret")

    with respx.mock(base_url="https://api.pluggy.ai") as respx_mock:
        respx_mock.post("/auth").respond(200, json={"apiKey": "key-123"})
        respx_mock.get("/accounts", params={"itemId": "item-123"}).side_effect = [
            Response(502, json={"message": "Bad Gateway"}),
            Response(200, json={"results": [{"id": "acc-1", "type": "BANK", "name": "Conta Corrente", "balance": 100.50}]}),
        ]

        async with PluggyClient(client_id="test_id", client_secret="test_secret", auth_manager=auth) as client:
            accounts = await client.accounts.list(item_id="item-123")
            assert len(accounts) == 1
            assert accounts[0].id == "acc-1"
            assert accounts[0].balance == Decimal("100.50")


@pytest.mark.asyncio
async def test_client_rate_limit_429():
    """Valida se 429 com Retry-After alto lança PluggyRateLimitError."""
    auth = PluggyAuthManager(client_id="test_id", client_secret="test_secret")

    with respx.mock(base_url="https://api.pluggy.ai") as respx_mock:
        respx_mock.post("/auth").respond(200, json={"apiKey": "key-123"})
        respx_mock.get("/items/item-123").respond(
            429,
            headers={"Retry-After": "60"},
            json={"message": "Rate limit exceeded"},
        )

        async with PluggyClient(client_id="test_id", client_secret="test_secret", auth_manager=auth) as client:
            with pytest.raises(PluggyRateLimitError) as exc_info:
                await client.items.get("item-123")
            assert exc_info.value.retry_after == 60.0


@pytest.mark.asyncio
async def test_transactions_v2_cursor_pagination_iterator():
    """Valida se o iterador assíncrono percorre transações via cursor (/v2/transactions)."""
    auth = PluggyAuthManager(client_id="test_id", client_secret="test_secret")

    with respx.mock(base_url="https://api.pluggy.ai") as respx_mock:
        respx_mock.post("/auth").respond(200, json={"apiKey": "key-123"})

        # Chamada 2 (mais específica com cursor): definida primeiro para o respx priorizar o match
        respx_mock.get("/v2/transactions", params={"accountId": "acc-1", "cursor": "cursor-abc"}).respond(
            200,
            json={
                "results": [
                    {"id": "tx-3", "description": "Cinema", "amount": 40.0, "currencyCode": "BRL", "date": "2026-10-22T19:00:00Z"},
                ],
                "next": None,
            },
        )
        # Chamada 1: sem cursor -> retorna next: "cursor-abc"
        respx_mock.get("/v2/transactions", params={"accountId": "acc-1"}).respond(
            200,
            json={
                "results": [
                    {"id": "tx-1", "description": "Lanche", "amount": 20.0, "currencyCode": "BRL", "date": "2026-10-20T10:00:00Z"},
                    {"id": "tx-2", "description": "Mercado", "amount": 150.0, "currencyCode": "BRL", "date": "2026-10-21T12:00:00Z"},
                ],
                "next": "cursor-abc",
            },
        )

        collected = []
        async with PluggyClient(client_id="test_id", client_secret="test_secret", auth_manager=auth) as client:
            async for tx in client.transactions.iterate(account_id="acc-1"):
                collected.append(tx)

        assert len(collected) == 3
        assert [t.id for t in collected] == ["tx-1", "tx-2", "tx-3"]
        assert collected[0].amount == Decimal("20.0")


def test_schemas_tolerance_to_missing_fields():
    """Valida a camada anti-corrupção dos schemas com ausência de campos opcionais."""
    minimal_tx = PluggyTransaction.model_validate({
        "id": "tx-min",
        "description": "Transferência",
        "amount": "100.00",
        "date": "2026-10-25T12:00:00Z",
    })
    assert minimal_tx.id == "tx-min"
    assert minimal_tx.amount == Decimal("100.00")
    assert minimal_tx.category is None
    assert minimal_tx.type is None

    minimal_acc = PluggyAccount.model_validate({
        "id": "acc-min",
        "type": "BANK",
        "name": "Conta Poupança",
    })
    assert minimal_acc.id == "acc-min"
    assert minimal_acc.balance is None
    assert minimal_acc.currency_code == "BRL"
