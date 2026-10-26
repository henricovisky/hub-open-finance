import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
import pytest
import pytest_asyncio
import respx
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.security import hash_password
from app.integrations.pluggy import PluggyClient
from app.models.base import FinancialContext, UserRole
from app.models.connection import ConnectionStatus, FinancialConnection, SyncTrigger
from app.models.finance import Account, AccountType
from app.models.investment import AssetClass, Bill, Investment, WealthSnapshot
from app.models.user import AccountPermission, User
from app.services.sync_service import SyncService, categorize_investment


def test_categorize_investment_heuristic():
    """Valida as regras heurísticas de classificação de ativos em classes macro."""
    assert categorize_investment("FIXED_INCOME", "CDB", "CDB Banco Inter 120% CDI") == "RENDA_FIXA"
    assert categorize_investment("FIXED_INCOME", "TESOURO", "Tesouro Selic 2029", "SELIC29") == "RENDA_FIXA"
    assert categorize_investment("EQUITY", "STOCK", "Petrobras PN", "PETR4") == "RENDA_VARIAVEL"
    assert categorize_investment("EQUITY", "STOCK", "Vale do Rio Doce ON", "VALE3") == "RENDA_VARIAVEL"
    assert categorize_investment("MUTUAL_FUND", "FII", "CSHG Logística FII", "HGLG11") == "FII"
    assert categorize_investment("ETF", "GLOBAL", "iShares S&P 500 Fundo de Índice", "IVVB11") == "INTERNACIONAL"
    assert categorize_investment("CRYPTO", "CRIPTO", "Hashdex Nasdaq Crypto Index", "HASH11") == "CRIPTO"
    assert categorize_investment("PENSION", "PGBL", "Itaú Flexprev Renda Fixa") == "PREVIDENCIA"
    assert categorize_investment("OTHER", None, "Ativo Estruturado XP") == "OUTROS"


@pytest.mark.asyncio
async def test_sync_bills_and_investments(test_db_session: AsyncSession):
    """Valida a sincronização completa de faturas de cartão e posições de investimentos."""
    # 1. Cria usuário Admin e Conexão de teste
    admin = User(
        email="admin_inv@example.com",
        password_hash=hash_password("password123"),
        name="Admin Inv",
        role=UserRole.ADMIN,
        is_active=True,
    )
    test_db_session.add(admin)
    await test_db_session.flush()

    conn = FinancialConnection(
        owner_user_id=admin.id,
        pluggy_item_id="item-bills-inv-123",
        connector_id=1,
        institution_name="Banco Rico & Cartão",
        status=ConnectionStatus.CONNECTED,
    )
    test_db_session.add(conn)
    await test_db_session.commit()

    # 2. Mock de respostas da Pluggy
    with respx.mock(base_url="https://api.pluggy.ai", assert_all_called=False) as respx_mock:
        respx_mock.post("/auth").respond(200, json={"apiKey": "fake-api-key"})
        respx_mock.get("/items/item-bills-inv-123").respond(
            200, json={"id": "item-bills-inv-123", "status": "UPDATED"}
        )
        respx_mock.get("/accounts", params={"itemId": "item-bills-inv-123"}).respond(
            200,
            json={
                "results": [
                    {
                        "id": "acc-credit-1",
                        "name": "Cartão Black",
                        "type": "CREDIT",
                        "balance": 0.0,
                        "currencyCode": "BRL",
                    },
                    {
                        "id": "acc-inv-1",
                        "name": "Conta Custódia",
                        "type": "INVESTMENT",
                        "balance": 50000.0,
                        "currencyCode": "BRL",
                    },
                ]
            },
        )
        # Transações vazias para simplificar
        respx_mock.get("/v2/transactions", params={"accountId": "acc-credit-1"}).respond(
            200, json={"results": [], "next": None}
        )
        respx_mock.get("/v2/transactions", params={"accountId": "acc-inv-1"}).respond(
            200, json={"results": [], "next": None}
        )
        # Faturas do Cartão
        respx_mock.get("/bills", params={"accountId": "acc-credit-1"}).respond(
            200,
            json={
                "results": [
                    {
                        "id": "bill-nov-2026",
                        "dueDate": "2026-11-10T00:00:00Z",
                        "closingDate": "2026-11-03T00:00:00Z",
                        "totalAmount": 1250.50,
                        "paidAmount": 0.0,
                        "openAmount": 1250.50,
                        "status": "OPEN",
                    }
                ]
            },
        )
        # Posições de Investimentos
        respx_mock.get("/investments", params={"itemId": "item-bills-inv-123"}).respond(
            200,
            json={
                "results": [
                    {
                        "id": "inv-cdb-1",
                        "name": "CDB Banco Inter 110% CDI",
                        "type": "FIXED_INCOME",
                        "subtype": "CDB",
                        "code": "CDB-INTER",
                        "balance": 30000.0,
                        "amount": 25000.0,
                        "currencyCode": "BRL",
                    },
                    {
                        "id": "inv-fii-1",
                        "name": "CSHG Logística FII",
                        "type": "MUTUAL_FUND",
                        "subtype": "FII",
                        "code": "HGLG11",
                        "balance": 20000.0,
                        "amount": 18000.0,
                        "currencyCode": "BRL",
                    },
                ]
            },
        )

        async with PluggyClient(client_id="dummy", client_secret="dummy") as client:
            run = await SyncService.sync_connection(db=test_db_session, connection_id=conn.id, client=client)

    assert str(run.status) in ["SUCCESS", "SyncStatus.SUCCESS"]

    # 3. Verifica se a fatura foi gravada
    bill_res = await test_db_session.execute(select(Bill).where(Bill.pluggy_bill_id == "bill-nov-2026"))
    bill = bill_res.scalar_one_or_none()
    assert bill is not None
    assert bill.total_amount == Decimal("1250.50")
    assert bill.status == "OPEN"

    # 4. Verifica se os investimentos foram gravados e classificados
    inv_res = await test_db_session.execute(
        select(Investment).options(selectinload(Investment.asset_class)).order_by(Investment.code)
    )
    investments = inv_res.scalars().all()
    assert len(investments) == 2

    cdb = next(i for i in investments if i.code == "CDB-INTER")
    assert cdb.balance == Decimal("30000.00")
    assert cdb.asset_class is not None
    assert cdb.asset_class.code == "RENDA_FIXA"

    fii = next(i for i in investments if i.code == "HGLG11")
    assert fii.balance == Decimal("20000.00")
    assert fii.asset_class is not None
    assert fii.asset_class.code == "FII"

    # 5. Verifica se o snapshot consolidado de patrimônio foi calculado
    snap_res = await test_db_session.execute(select(WealthSnapshot).where(WealthSnapshot.snapshot_date == date.today()))
    snapshot = snap_res.scalar_one_or_none()
    assert snapshot is not None
    assert snapshot.investment_balance == Decimal("50000.00")
    assert snapshot.credit_card_debt == Decimal("1250.50")
    assert snapshot.net_worth == Decimal("48749.50")


@pytest.mark.asyncio
async def test_wealth_endpoints_and_rbac_visibility(
    async_client: AsyncClient,
    test_db_session: AsyncSession,
):
    """
    Valida endpoints de faturas, investimentos e patrimônio líquido (/wealth/summary),
    garantindo o isolamento RBAC estrito entre Administrador e Membro.
    """
    # 1. Cria Admin e Membro
    admin = User(
        email="admin_wealth@example.com",
        password_hash=hash_password("password123"),
        name="Admin Wealth",
        role=UserRole.ADMIN,
        is_active=True,
    )
    member = User(
        email="member_wealth@example.com",
        password_hash=hash_password("password123"),
        name="Member Esposa",
        role=UserRole.MEMBER,
        is_active=True,
    )
    test_db_session.add_all([admin, member])
    await test_db_session.flush()

    # 2. Conexão e Contas: Casa (Household) e Pessoal (Personal)
    conn = FinancialConnection(
        owner_user_id=admin.id,
        pluggy_item_id="item-wealth-rbac",
        connector_id=1,
        institution_name="Nubank & Rico",
        status=ConnectionStatus.CONNECTED,
    )
    test_db_session.add(conn)
    await test_db_session.flush()

    # Conta Casa (visível para o Membro)
    acc_household = Account(
        connection_id=conn.id,
        pluggy_account_id="acc-house-1",
        name="Nubank Casa (Conjunta)",
        type=AccountType.BANK,
        current_balance=Decimal("5000.00"),
        owner_context=FinancialContext.HOUSEHOLD,
        is_active=True,
    )
    # Cartão Casa (visível para o Membro)
    acc_card_house = Account(
        connection_id=conn.id,
        pluggy_account_id="acc-card-house-1",
        name="Nubank Cartão Casa",
        type=AccountType.CREDIT,
        current_balance=Decimal("0.00"),
        owner_context=FinancialContext.HOUSEHOLD,
        is_active=True,
    )
    # Conta Investimento Pessoal (NÃO visível para o Membro)
    acc_inv_personal = Account(
        connection_id=conn.id,
        pluggy_account_id="acc-inv-pers-1",
        name="Rico Pessoal",
        type=AccountType.INVESTMENT,
        current_balance=Decimal("0.00"),
        owner_context=FinancialContext.PERSONAL,
        is_active=True,
    )
    test_db_session.add_all([acc_household, acc_card_house, acc_inv_personal])
    await test_db_session.flush()

    # Permissão para o Membro APENAS nas contas da Casa
    test_db_session.add_all([
        AccountPermission(user_id=member.id, account_id=acc_household.id, can_view=True, can_categorize=True),
        AccountPermission(user_id=member.id, account_id=acc_card_house.id, can_view=True, can_categorize=True),
    ])

    # Fatura no Cartão Casa
    bill_house = Bill(
        account_id=acc_card_house.id,
        pluggy_bill_id="bill-house-1",
        due_date=datetime(2026, 11, 15, tzinfo=timezone.utc),
        total_amount=Decimal("1500.00"),
        paid_amount=Decimal("0.00"),
        status="OPEN",
    )
    # Investimento na Conta Pessoal
    rf_class = AssetClass(id=uuid.uuid4(), code="RENDA_FIXA", name="Renda Fixa")
    test_db_session.add(rf_class)
    await test_db_session.flush()

    inv_personal = Investment(
        account_id=acc_inv_personal.id,
        pluggy_investment_id="inv-pers-1",
        code="TESOURO-SELIC",
        name="Tesouro Selic 2029",
        type="FIXED_INCOME",
        balance=Decimal("80000.00"),
        asset_class_id=rf_class.id,
    )
    test_db_session.add_all([bill_house, inv_personal])
    await test_db_session.commit()

    # Gera snapshot
    await SyncService.generate_daily_wealth_snapshot(test_db_session)

    # 3. Teste como Administrador
    login_admin = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin_wealth@example.com", "password": "password123"},
    )
    assert login_admin.status_code == 200

    admin_summary = await async_client.get("/api/v1/wealth/summary")
    assert admin_summary.status_code == 200
    data_admin = admin_summary.json()
    assert Decimal(str(data_admin["cash_balance"])) == Decimal("5000.00")
    assert Decimal(str(data_admin["investment_balance"])) == Decimal("80000.00")
    assert Decimal(str(data_admin["credit_card_debt"])) == Decimal("1500.00")
    assert Decimal(str(data_admin["net_worth"])) == Decimal("83500.00")
    assert Decimal(str(data_admin["household_net_worth"])) == Decimal("3500.00")  # 5000 - 1500
    assert Decimal(str(data_admin["personal_net_worth"])) == Decimal("80000.00")

    # Admin consulta lista de investimentos (vê o pessoal)
    admin_invs = await async_client.get("/api/v1/investments")
    assert admin_invs.status_code == 200
    assert len(admin_invs.json()) == 1

    # 4. Teste como Membro (Esposa)
    async_client.cookies.clear()
    login_member = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "member_wealth@example.com", "password": "password123"},
    )
    assert login_member.status_code == 200

    # Membro consulta /wealth/summary: patrimônio pessoal fica oculto / zero
    member_summary = await async_client.get("/api/v1/wealth/summary")
    assert member_summary.status_code == 200
    data_member = member_summary.json()
    assert Decimal(str(data_member["net_worth"])) == Decimal("3500.00")  # Apenas conjunto
    assert Decimal(str(data_member["household_net_worth"])) == Decimal("3500.00")
    assert Decimal(str(data_member["personal_net_worth"])) == Decimal("0.00")

    # Membro consulta lista de investimentos: como a conta é Pessoal (sem permissão), lista vem vazia!
    member_invs = await async_client.get("/api/v1/investments")
    assert member_invs.status_code == 200
    assert len(member_invs.json()) == 0

    # Membro tenta acessar diretamente o ID do investimento pessoal -> 403 Forbidden!
    inv_forbidden = await async_client.get(f"/api/v1/investments/{inv_personal.id}")
    assert inv_forbidden.status_code == 403

    # Membro acessa a fatura da Casa -> 200 OK!
    bill_ok = await async_client.get(f"/api/v1/bills/{bill_house.id}")
    assert bill_ok.status_code == 200
    assert Decimal(str(bill_ok.json()["total_amount"])) == Decimal("1500.00")


@pytest.mark.asyncio
async def test_sync_fallback_when_bills_and_investments_unavailable(test_db_session: AsyncSession):
    """Garante resiliência caso o conector retorne 404 ou não suporte faturas/investimentos."""
    admin = User(
        email="admin_fallback@example.com",
        password_hash=hash_password("password123"),
        name="Admin Fallback",
        role=UserRole.ADMIN,
        is_active=True,
    )
    test_db_session.add(admin)
    await test_db_session.flush()

    conn = FinancialConnection(
        owner_user_id=admin.id,
        pluggy_item_id="item-fallback-123",
        connector_id=2,
        institution_name="Banco Simples Sem Investimentos",
        status=ConnectionStatus.CONNECTED,
    )
    test_db_session.add(conn)
    await test_db_session.commit()

    with respx.mock(base_url="https://api.pluggy.ai", assert_all_called=False) as respx_mock:
        respx_mock.post("/auth").respond(200, json={"apiKey": "fake-api-key"})
        respx_mock.get("/items/item-fallback-123").respond(
            200, json={"id": "item-fallback-123", "status": "UPDATED"}
        )
        respx_mock.get("/accounts", params={"itemId": "item-fallback-123"}).respond(
            200,
            json={
                "results": [
                    {
                        "id": "acc-bank-fallback",
                        "name": "Conta Corrente",
                        "type": "BANK",
                        "balance": 2500.0,
                        "currencyCode": "BRL",
                    }
                ]
            },
        )
        respx_mock.get("/v2/transactions", params={"accountId": "acc-bank-fallback"}).respond(
            200, json={"results": [], "next": None}
        )
        # 404 em investimentos (produto não disponível no conector)
        respx_mock.get("/investments", params={"itemId": "item-fallback-123"}).respond(
            404, json={"message": "Investments not supported for this connector"}
        )

        async with PluggyClient(client_id="dummy", client_secret="dummy") as client:
            run = await SyncService.sync_connection(db=test_db_session, connection_id=conn.id, client=client)

    assert str(run.status) in ["SUCCESS", "SyncStatus.SUCCESS"]

    # Valida que o saldo da conta corrente gerou snapshot de patrimônio
    snap_res = await test_db_session.execute(select(WealthSnapshot).where(WealthSnapshot.snapshot_date == date.today()))
    snapshot = snap_res.scalar_one_or_none()
    assert snapshot is not None
    assert snapshot.cash_balance == Decimal("2500.00")
    assert snapshot.investment_balance == Decimal("0.00")
    assert snapshot.net_worth == Decimal("2500.00")

