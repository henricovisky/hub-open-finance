import asyncio
from decimal import Decimal
import pytest
import respx
from httpx import AsyncClient, Response
from app.models.base import FinancialContext
from app.models.finance import Account, Transaction, TransactionType
from app.models.user import AccountPermission


@pytest.mark.asyncio
async def test_sync_connection_and_idempotency(async_client: AsyncClient, test_db_session, create_test_users):
    """
    Testa a sincronização de contas e transações da Etapa 5:
    - Sincronização inicial insere contas e transações corretamente.
    - Sincronizações repetidas 3 vezes resultam em zero duplicatas (idempotência garantida).
    """
    async_client.cookies.clear()
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "AdminPass123!"},
    )
    admin_token = admin_login.json()["access_token"]
    item_id = "sync-test-item-001"
    account_id = "pluggy-acc-checking-01"

    with respx.mock(base_url="https://api.pluggy.ai", assert_all_called=False) as respx_mock:
        respx_mock.post("/auth").respond(200, json={"apiKey": "mock-api-key"})
        respx_mock.get(f"/items/{item_id}").respond(
            200,
            json={
                "id": item_id,
                "status": "UPDATED",
                "connector": {"id": 2, "name": "Pluggy Bank"},
            },
        )
        respx_mock.get("/accounts").respond(
            200,
            json={
                "results": [
                    {
                        "id": account_id,
                        "itemId": item_id,
                        "name": "Conta Corrente",
                        "type": "BANK",
                        "subtype": "CHECKING_ACCOUNT",
                        "balance": 2500.50,
                        "currencyCode": "BRL",
                    }
                ]
            },
        )
        respx_mock.get("/v2/transactions").respond(
            200,
            json={
                "results": [
                    {
                        "id": "tx-sync-1",
                        "description": "Salário Mensal",
                        "amount": 5000.00,
                        "currencyCode": "BRL",
                        "date": "2026-10-20T10:00:00Z",
                        "type": "CREDIT",
                        "status": "POSTED",
                        "category": "Salário",
                    },
                    {
                        "id": "tx-sync-2",
                        "description": "Conta de Energia",
                        "amount": -180.25,
                        "currencyCode": "BRL",
                        "date": "2026-10-22T14:30:00Z",
                        "type": "DEBIT",
                        "status": "POSTED",
                        "category": "Utilidades",
                    },
                ],
                "next": None,
            },
        )

        # 1. Registrar conexão
        comp_resp = await async_client.post(
            "/api/v1/connections/complete",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"item_id": item_id},
        )
        assert comp_resp.status_code == 201
        conn_id = comp_resp.json()["id"]

        # 2. Executar Sincronização 3 vezes seguidas
        for i in range(3):
            sync_resp = await async_client.post(
                f"/api/v1/connections/{conn_id}/sync",
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert sync_resp.status_code == 200
            sync_data = sync_resp.json()
            assert sync_data["status"] == "SUCCESS"
            if i == 0:
                assert sync_data["records_inserted"] == 2
                assert sync_data["records_updated"] == 0
            else:
                # Nas sincronizações 2 e 3, zero duplicatas inseridas!
                assert sync_data["records_inserted"] == 0
                assert sync_data["records_updated"] == 2

        # 3. Validar listagem de contas
        accs_resp = await async_client.get(
            "/api/v1/accounts",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert accs_resp.status_code == 200
        accounts = accs_resp.json()
        assert len(accounts) == 1
        assert accounts[0]["pluggy_account_id"] == account_id
        assert accounts[0]["current_balance"] == "2500.50"

        # 4. Validar listagem de transações (exatamente 2 no total)
        txs_resp = await async_client.get(
            "/api/v1/transactions",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert txs_resp.status_code == 200
        tx_data = txs_resp.json()
        assert tx_data["total"] == 2
        assert len(tx_data["results"]) == 2


@pytest.mark.asyncio
async def test_member_visibility_isolation(async_client: AsyncClient, test_db_session, create_test_users):
    """
    Testa isolamento da matriz de visibilidade para MEMBER:
    - MEMBER não vê contas alheias por padrão.
    - MEMBER só vê contas onde can_view == True.
    - Tentativa de acessar conta alheia por ID retorna 404 (sem vazar metadados).
    """
    admin_user = create_test_users["admin"]
    member_user = create_test_users["member"]

    # Cria duas contas no banco
    acc_household = Account(
        connection_id=admin_user.id,  # dummy fk
        pluggy_account_id="pluggy-acc-nubank-casa",
        name="Nubank Casa",
        type="BANK",
        currency="BRL",
        current_balance=Decimal("1500.00"),
        owner_context=FinancialContext.HOUSEHOLD,
        is_active=True,
    )
    acc_personal = Account(
        connection_id=admin_user.id,
        pluggy_account_id="pluggy-acc-itau-pessoal",
        name="Itaú Pessoal",
        type="BANK",
        currency="BRL",
        current_balance=Decimal("9800.00"),
        owner_context=FinancialContext.PERSONAL,
        is_active=True,
    )
    test_db_session.add_all([acc_household, acc_personal])
    await test_db_session.flush()

    # Transação da casa e transação pessoal
    tx1 = Transaction(
        account_id=acc_household.id,
        pluggy_transaction_id="tx-nubank-1",
        date=acc_household.created_at,
        description="Feira da Semana",
        amount=Decimal("-120.00"),
        currency="BRL",
        type=TransactionType.EXPENSE,
        context=FinancialContext.HOUSEHOLD,
    )
    tx2 = Transaction(
        account_id=acc_personal.id,
        pluggy_transaction_id="tx-itau-1",
        date=acc_personal.created_at,
        description="Compra Individual",
        amount=Decimal("-450.00"),
        currency="BRL",
        type=TransactionType.EXPENSE,
        context=FinancialContext.PERSONAL,
    )
    test_db_session.add_all([tx1, tx2])
    await test_db_session.commit()

    # 1. Login como MEMBER antes de ter permissão
    async_client.cookies.clear()
    member_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "member@test.com", "password": "MemberPass123!"},
    )
    member_token = member_login.json()["access_token"]
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # Deve receber lista vazia (negar por padrão)
    member_accs = await async_client.get("/api/v1/accounts", headers=member_headers)
    assert member_accs.status_code == 200
    assert len(member_accs.json()) == 0

    # 2. Concede permissão para a conta da CASA apenas
    permission = AccountPermission(
        user_id=member_user.id,
        account_id=acc_household.id,
        can_view=True,
        can_categorize=True,
    )
    test_db_session.add(permission)
    await test_db_session.commit()

    # Agora o MEMBER deve ver apenas a conta da CASA
    member_accs_after = await async_client.get("/api/v1/accounts", headers=member_headers)
    assert member_accs_after.status_code == 200
    results = member_accs_after.json()
    assert len(results) == 1
    assert results[0]["id"] == str(acc_household.id)
    assert results[0]["name"] == "Nubank Casa"

    # Tentativa de acessar conta PESSOAL diretamente por ID retorna 404
    forbidden_acc = await async_client.get(f"/api/v1/accounts/{acc_personal.id}", headers=member_headers)
    assert forbidden_acc.status_code == 404

    # Transações listadas para o MEMBER só incluem a transação da CASA
    member_txs = await async_client.get("/api/v1/transactions", headers=member_headers)
    assert member_txs.status_code == 200
    tx_results = member_txs.json()["results"]
    assert len(tx_results) == 1
    assert tx_results[0]["description"] == "Feira da Semana"


@pytest.mark.asyncio
async def test_credit_card_bill_payment_rule(async_client: AsyncClient, test_db_session, create_test_users):
    """
    Testa a regra canônica de cartão de crédito (DTI §8.2 e DDI UI-012):
    Pagamento de fatura no extrato do cartão é normalizado como liquidação/TRANSFER,
    não gerando contagem dupla de despesa.
    """
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "AdminPass123!"},
    )
    admin_token = admin_login.json()["access_token"]
    item_id = "card-rule-item-002"
    card_acc_id = "pluggy-card-01"

    with respx.mock(base_url="https://api.pluggy.ai", assert_all_called=False) as respx_mock:
        respx_mock.post("/auth").respond(200, json={"apiKey": "mock-api-key"})
        respx_mock.get(f"/items/{item_id}").respond(
            200,
            json={"id": item_id, "status": "UPDATED", "connector": {"id": 2, "name": "Pluggy Bank"}},
        )
        respx_mock.get("/accounts").respond(
            200,
            json={
                "results": [
                    {
                        "id": card_acc_id,
                        "itemId": item_id,
                        "name": "Cartão Black",
                        "type": "CREDIT",
                        "subtype": "CREDIT_CARD",
                        "balance": -850.00,
                        "currencyCode": "BRL",
                    }
                ]
            },
        )
        respx_mock.get("/v2/transactions").respond(
            200,
            json={
                "results": [
                    {
                        "id": "tx-card-compra",
                        "description": "Restaurante",
                        "amount": -150.00,
                        "currencyCode": "BRL",
                        "date": "2026-10-21T20:00:00Z",
                        "type": "DEBIT",
                    },
                    {
                        "id": "tx-card-fatura-pgto",
                        "description": "Pagamento de Fatura",
                        "amount": 1000.00,
                        "currencyCode": "BRL",
                        "date": "2026-10-22T10:00:00Z",
                        "type": "CREDIT",
                    },
                ],
                "next": None,
            },
        )

        comp_resp = await async_client.post(
            "/api/v1/connections/complete",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"item_id": item_id},
        )
        conn_id = comp_resp.json()["id"]

        sync_resp = await async_client.post(
            f"/api/v1/connections/{conn_id}/sync",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert sync_resp.status_code == 200

        # Verifica tipo das transações
        txs = await async_client.get("/api/v1/transactions", headers={"Authorization": f"Bearer {admin_token}"})
        assert txs.status_code == 200
        results = {t["description"]: t["type"] for t in txs.json()["results"]}
        assert results["Restaurante"] == "EXPENSE"
        assert results["Pagamento de Fatura"] == "TRANSFER"
