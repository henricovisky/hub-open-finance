import uuid
from datetime import datetime, timezone
from decimal import Decimal
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import hash_password
from app.models.base import FinancialContext, UserRole
from app.models.connection import ConnectionStatus, FinancialConnection
from app.models.finance import Account, AccountType, Category, Transaction, TransactionStatus, TransactionType
from app.models.investment import Bill, WealthSnapshot
from app.models.user import AccountPermission, User


@pytest.mark.asyncio
async def test_dashboard_overview_metrics_and_moving_averages(
    async_client: AsyncClient,
    test_db_session: AsyncSession,
):
    """
    Valida o cálculo dos indicadores essenciais do Dashboard:
    - Saldo líquido disponível
    - Receitas e despesas do mês corrente
    - Exclusão de transferências internas e despesas marcadas como ignoradas
    - Média móvel dos 3 meses anteriores
    - Dívida de fatura de cartão em aberto
    """
    admin = User(
        email="admin_dash@example.com",
        password_hash=hash_password("password123"),
        name="Admin Dash",
        role=UserRole.ADMIN,
        is_active=True,
    )
    test_db_session.add(admin)
    await test_db_session.flush()

    conn = FinancialConnection(
        owner_user_id=admin.id,
        pluggy_item_id="item-dash-01",
        connector_id=1,
        institution_name="Banco Principal",
        status=ConnectionStatus.CONNECTED,
    )
    test_db_session.add(conn)
    await test_db_session.flush()

    # Conta Corrente com R$ 10.000 de saldo
    acc = Account(
        connection_id=conn.id,
        pluggy_account_id="acc-dash-01",
        name="Conta Principal",
        type=AccountType.BANK,
        current_balance=Decimal("10000.00"),
        owner_context=FinancialContext.HOUSEHOLD,
        is_active=True,
    )
    test_db_session.add(acc)
    await test_db_session.flush()

    # Mês atual (ano e mês dinâmicos)
    now = datetime.now(timezone.utc)
    curr_date = datetime(now.year, now.month, 10, 12, 0, 0, tzinfo=timezone.utc)

    # Transações do Mês Atual
    tx_salario = Transaction(
        account_id=acc.id,
        pluggy_transaction_id="tx-salario-curr",
        date=curr_date,
        description="Salário",
        amount=Decimal("8000.00"),
        type=TransactionType.INCOME,
        status=TransactionStatus.POSTED,
        context=FinancialContext.HOUSEHOLD,
    )
    tx_mercado = Transaction(
        account_id=acc.id,
        pluggy_transaction_id="tx-mercado-curr",
        date=curr_date,
        description="Supermercado",
        amount=Decimal("2500.00"),
        type=TransactionType.EXPENSE,
        status=TransactionStatus.POSTED,
        context=FinancialContext.HOUSEHOLD,
    )
    # Transferência interna (deve ser ignorada no total de receitas/despesas)
    tx_transfer = Transaction(
        account_id=acc.id,
        pluggy_transaction_id="tx-transf-curr",
        date=curr_date,
        description="Transferência Poupança",
        amount=Decimal("1000.00"),
        type=TransactionType.TRANSFER,
        is_internal_transfer=True,
        status=TransactionStatus.POSTED,
        context=FinancialContext.HOUSEHOLD,
    )
    # Despesa desconsiderada em analytics
    tx_ignored = Transaction(
        account_id=acc.id,
        pluggy_transaction_id="tx-ignored-curr",
        date=curr_date,
        description="Reembolso de Terceiro",
        amount=Decimal("500.00"),
        type=TransactionType.EXPENSE,
        is_ignored_in_analytics=True,
        status=TransactionStatus.POSTED,
        context=FinancialContext.HOUSEHOLD,
    )

    # Transações dos 3 Meses Anteriores para formar média
    prev_txs = []
    for m_back in [1, 2, 3]:
        prev_m = now.month - m_back
        prev_y = now.year
        while prev_m <= 0:
            prev_m += 12
            prev_y -= 1
        p_dt = datetime(prev_y, prev_m, 15, 10, 0, 0, tzinfo=timezone.utc)
        prev_txs.append(
            Transaction(
                account_id=acc.id,
                pluggy_transaction_id=f"tx-inc-{m_back}",
                date=p_dt,
                description=f"Salário Mês -{m_back}",
                amount=Decimal("6000.00"),
                type=TransactionType.INCOME,
                context=FinancialContext.HOUSEHOLD,
            )
        )
        prev_txs.append(
            Transaction(
                account_id=acc.id,
                pluggy_transaction_id=f"tx-exp-{m_back}",
                date=p_dt,
                description=f"Gastos Mês -{m_back}",
                amount=Decimal("3000.00"),
                type=TransactionType.EXPENSE,
                context=FinancialContext.HOUSEHOLD,
            )
        )

    # Fatura de Cartão Aberta
    bill = Bill(
        account_id=acc.id,
        pluggy_bill_id="bill-dash-01",
        due_date=curr_date,
        total_amount=Decimal("1800.00"),
        paid_amount=Decimal("300.00"),  # Aberto restante: 1500.00
        status="OPEN",
    )

    test_db_session.add_all([tx_salario, tx_mercado, tx_transfer, tx_ignored, bill] + prev_txs)
    await test_db_session.commit()

    # Login como Admin
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin_dash@example.com", "password": "password123"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]

    # Consulta Dashboard Overview
    overview_resp = await async_client.get(
        "/api/v1/dashboard/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert overview_resp.status_code == 200
    data = overview_resp.json()

    assert Decimal(str(data["liquid_balance"])) == Decimal("10000.00")
    assert Decimal(str(data["monthly_income"])) == Decimal("8000.00")
    assert Decimal(str(data["monthly_expenses"])) == Decimal("2500.00")
    assert Decimal(str(data["monthly_net"])) == Decimal("5500.00")  # 8000 - 2500
    assert Decimal(str(data["pending_bills_amount"])) == Decimal("1500.00")  # 1800 - 300
    assert Decimal(str(data["three_month_avg_income"])) == Decimal("6000.00")  # 18000 / 3
    assert Decimal(str(data["three_month_avg_expenses"])) == Decimal("3000.00")  # 9000 / 3


@pytest.mark.asyncio
async def test_dashboard_categories_and_variation_vs_average(
    async_client: AsyncClient,
    test_db_session: AsyncSession,
):
    """Valida o agrupamento de despesas por categoria e comparação percentual contra média móvel."""
    admin = User(
        email="admin_cat@example.com",
        password_hash=hash_password("password123"),
        name="Admin Cat",
        role=UserRole.ADMIN,
        is_active=True,
    )
    test_db_session.add(admin)
    await test_db_session.flush()

    conn = FinancialConnection(
        owner_user_id=admin.id,
        pluggy_item_id="item-cat-01",
        connector_id=1,
        institution_name="Banco Categorias",
        status=ConnectionStatus.CONNECTED,
    )
    test_db_session.add(conn)
    await test_db_session.flush()

    acc = Account(
        connection_id=conn.id,
        pluggy_account_id="acc-cat-01",
        name="Conta Cartão",
        type=AccountType.CREDIT,
        current_balance=Decimal("0.00"),
        owner_context=FinancialContext.HOUSEHOLD,
        is_active=True,
    )
    cat_mercado = Category(id=uuid.uuid4(), name="Alimentação", context=FinancialContext.HOUSEHOLD, color="#10B981")
    cat_transporte = Category(id=uuid.uuid4(), name="Transporte", context=FinancialContext.HOUSEHOLD, color="#3B82F6")
    test_db_session.add_all([acc, cat_mercado, cat_transporte])
    await test_db_session.flush()

    now = datetime.now(timezone.utc)
    curr_dt = datetime(now.year, now.month, 12, 10, 0, 0, tzinfo=timezone.utc)

    # Transação do mês atual: Alimentação = R$ 1200, Transporte = R$ 400
    tx1 = Transaction(
        account_id=acc.id,
        pluggy_transaction_id="tx-cat-curr-1",
        date=curr_dt,
        description="Supermercado ABC",
        amount=Decimal("1200.00"),
        type=TransactionType.EXPENSE,
        category_id=cat_mercado.id,
        context=FinancialContext.HOUSEHOLD,
    )
    tx2 = Transaction(
        account_id=acc.id,
        pluggy_transaction_id="tx-cat-curr-2",
        date=curr_dt,
        description="Combustível Posto",
        amount=Decimal("400.00"),
        type=TransactionType.EXPENSE,
        category_id=cat_transporte.id,
        context=FinancialContext.HOUSEHOLD,
    )

    # Média histórica anterior (Alimentação média = R$ 1000/mês, ou seja R$ 3000 nos 3 meses)
    hist_txs = []
    for m in [1, 2, 3]:
        prev_m = now.month - m
        prev_y = now.year
        while prev_m <= 0:
            prev_m += 12
            prev_y -= 1
        h_dt = datetime(prev_y, prev_m, 10, 0, 0, 0, tzinfo=timezone.utc)
        hist_txs.append(
            Transaction(
                account_id=acc.id,
                pluggy_transaction_id=f"tx-hist-{m}",
                date=h_dt,
                description="Mercado Passado",
                amount=Decimal("1000.00"),
                type=TransactionType.EXPENSE,
                category_id=cat_mercado.id,
                context=FinancialContext.HOUSEHOLD,
            )
        )

    test_db_session.add_all([tx1, tx2] + hist_txs)
    await test_db_session.commit()

    # Login
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin_cat@example.com", "password": "password123"},
    )
    token = login_resp.json()["access_token"]

    # Consulta categorias
    resp = await async_client.get(
        "/api/v1/dashboard/categories",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 2

    # Primeira categoria deve ser Alimentação (R$ 1200)
    food_item = next(i for i in items if i["category_name"] == "Alimentação")
    assert Decimal(str(food_item["total_amount"])) == Decimal("1200.00")
    assert Decimal(str(food_item["three_month_avg"])) == Decimal("1000.00")
    # Variação esperada: (1200 - 1000) / 1000 * 100 = +20.0%
    assert Decimal(str(food_item["variation_vs_avg_pct"])) == Decimal("20.0")


@pytest.mark.asyncio
async def test_transaction_categorization_and_rbac(
    async_client: AsyncClient,
    test_db_session: AsyncSession,
):
    """
    Testa PATCH /transactions/{id} com regras de RBAC:
    - Admin pode editar qualquer transação.
    - Membro pode editar transações de contas onde can_categorize=True.
    - Membro recebe 403 Forbidden se can_categorize=False.
    """
    admin = User(
        email="admin_tx@example.com",
        password_hash=hash_password("password123"),
        name="Admin TX",
        role=UserRole.ADMIN,
        is_active=True,
    )
    member = User(
        email="member_tx@example.com",
        password_hash=hash_password("password123"),
        name="Member TX",
        role=UserRole.MEMBER,
        is_active=True,
    )
    test_db_session.add_all([admin, member])
    await test_db_session.flush()

    conn = FinancialConnection(
        owner_user_id=admin.id,
        pluggy_item_id="item-tx-rbac",
        connector_id=1,
        institution_name="Banco RBAC",
        status=ConnectionStatus.CONNECTED,
    )
    test_db_session.add(conn)
    await test_db_session.flush()

    # Conta 1: Membro pode visualizar e categorizar
    acc_allowed = Account(
        connection_id=conn.id,
        pluggy_account_id="acc-allowed",
        name="Conta Casa",
        type=AccountType.BANK,
        current_balance=Decimal("1000.00"),
        owner_context=FinancialContext.HOUSEHOLD,
        is_active=True,
    )
    # Conta 2: Membro apenas visualiza, NÃO pode categorizar
    acc_readonly = Account(
        connection_id=conn.id,
        pluggy_account_id="acc-readonly",
        name="Conta Somente Leitura",
        type=AccountType.BANK,
        current_balance=Decimal("500.00"),
        owner_context=FinancialContext.HOUSEHOLD,
        is_active=True,
    )
    test_db_session.add_all([acc_allowed, acc_readonly])
    await test_db_session.flush()

    test_db_session.add_all([
        AccountPermission(user_id=member.id, account_id=acc_allowed.id, can_view=True, can_categorize=True),
        AccountPermission(user_id=member.id, account_id=acc_readonly.id, can_view=True, can_categorize=False),
    ])

    cat = Category(id=uuid.uuid4(), name="Lazer", context=FinancialContext.HOUSEHOLD)
    test_db_session.add(cat)
    await test_db_session.flush()

    tx1 = Transaction(
        account_id=acc_allowed.id,
        pluggy_transaction_id="tx-editable-01",
        date=datetime.now(timezone.utc),
        description="Cinema",
        amount=Decimal("50.00"),
        type=TransactionType.EXPENSE,
        context=FinancialContext.HOUSEHOLD,
    )
    tx2 = Transaction(
        account_id=acc_readonly.id,
        pluggy_transaction_id="tx-readonly-01",
        date=datetime.now(timezone.utc),
        description="Livro",
        amount=Decimal("80.00"),
        type=TransactionType.EXPENSE,
        context=FinancialContext.HOUSEHOLD,
    )
    test_db_session.add_all([tx1, tx2])
    await test_db_session.commit()

    # Login como Membro
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "member_tx@example.com", "password": "password123"},
    )
    member_token = login_resp.json()["access_token"]

    # 1. Membro atualiza tx1 na conta com permissão de categorização -> 200 OK
    patch_ok = await async_client.patch(
        f"/api/v1/transactions/{tx1.id}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"category_id": str(cat.id)},
    )
    assert patch_ok.status_code == 200
    assert patch_ok.json()["category_id"] == str(cat.id)

    # 2. Membro tenta atualizar tx2 na conta somente leitura -> 403 Forbidden!
    patch_forbidden = await async_client.patch(
        f"/api/v1/transactions/{tx2.id}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"category_id": str(cat.id)},
    )
    assert patch_forbidden.status_code == 403
