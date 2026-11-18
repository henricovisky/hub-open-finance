import uuid
from datetime import datetime, timezone
from decimal import Decimal
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import hash_password
from app.models.base import FinancialContext, UserRole
from app.models.connection import ConnectionStatus, FinancialConnection
from app.models.finance import Account, AccountType, Card, Category, Transaction, TransactionStatus, TransactionType
from app.models.user import User


@pytest.mark.asyncio
async def test_categories_endpoints(
    async_client: AsyncClient,
    test_db_session: AsyncSession,
):
    admin = User(
        email="admin_cat_test@example.com",
        password_hash=hash_password("password123"),
        name="Admin Cat",
        role=UserRole.ADMIN,
        is_active=True,
    )
    test_db_session.add(admin)
    await test_db_session.commit()
    await test_db_session.refresh(admin)

    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin_cat_test@example.com", "password": "password123"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Seed defaults
    seed_res = await async_client.post("/api/v1/categories/seed-defaults", headers=headers)
    assert seed_res.status_code == 201
    seed_data = seed_res.json()
    assert "created_count" in seed_data

    # 2. List categories without context or with empty context
    res_all = await async_client.get("/api/v1/categories", headers=headers)
    assert res_all.status_code == 200
    assert len(res_all.json()) > 0

    res_empty_ctx = await async_client.get("/api/v1/categories?context=", headers=headers)
    assert res_empty_ctx.status_code == 200
    assert len(res_empty_ctx.json()) > 0

    # 3. Create category with budget_limit and type
    create_res = await async_client.post(
        "/api/v1/categories",
        json={
            "name": "Streaming & Games",
            "type": "LIFESTYLE",
            "budget_limit": "150.00",
            "icon": "gamepad",
            "color": "#8B5CF6",
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    created_cat = create_res.json()
    assert created_cat["name"] == "Streaming & Games"
    assert created_cat["is_essential"] is False
    assert float(created_cat["budget_amount"]) == 150.00
    assert float(created_cat["budget_limit"]) == 150.00


@pytest.mark.asyncio
async def test_transaction_apply_to_similar(
    async_client: AsyncClient,
    test_db_session: AsyncSession,
):
    admin = User(
        email="admin_tx_similar@example.com",
        password_hash=hash_password("password123"),
        name="Admin Similar",
        role=UserRole.ADMIN,
        is_active=True,
    )
    test_db_session.add(admin)
    await test_db_session.flush()

    conn = FinancialConnection(
        owner_user_id=admin.id,
        pluggy_item_id="item-similar-01",
        connector_id=1,
        institution_name="Banco Similar",
        status=ConnectionStatus.CONNECTED,
    )
    test_db_session.add(conn)
    await test_db_session.flush()

    acc = Account(
        connection_id=conn.id,
        pluggy_account_id="acc-similar-01",
        name="Conta Similar",
        type=AccountType.BANK,
        current_balance=Decimal("5000.00"),
        owner_context=FinancialContext.HOUSEHOLD,
        is_active=True,
        is_hidden=False,
    )
    test_db_session.add(acc)
    await test_db_session.flush()

    cat1 = Category(
        name="Supermercado Padrão",
        context=FinancialContext.HOUSEHOLD,
        budget_amount=Decimal("1000.00"),
        is_essential=True,
    )
    test_db_session.add(cat1)
    await test_db_session.flush()

    now = datetime.now(timezone.utc)
    tx1 = Transaction(
        account_id=acc.id,
        pluggy_transaction_id="tx-sim-1",
        date=now,
        description="Pao de Acucar Loja 1",
        amount=Decimal("-120.00"),
        type=TransactionType.EXPENSE,
        context=FinancialContext.HOUSEHOLD,
        first_seen_at=now,
        last_seen_at=now,
    )
    tx2 = Transaction(
        account_id=acc.id,
        pluggy_transaction_id="tx-sim-2",
        date=now,
        description="Pao de Acucar Loja 1",
        amount=Decimal("-85.50"),
        type=TransactionType.EXPENSE,
        context=FinancialContext.HOUSEHOLD,
        first_seen_at=now,
        last_seen_at=now,
    )
    test_db_session.add_all([tx1, tx2])
    await test_db_session.commit()

    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin_tx_similar@example.com", "password": "password123"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Patch tx1 com apply_to_similar=True
    patch_res = await async_client.patch(
        f"/api/v1/transactions/{tx1.id}",
        json={"category_id": str(cat1.id), "apply_to_similar": True},
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["category_id"] == str(cat1.id)

    # Verifica se tx2 também foi categorizada
    tx2_res = await async_client.get(f"/api/v1/transactions/{tx2.id}", headers=headers)
    assert tx2_res.status_code == 200
    assert tx2_res.json()["category_id"] == str(cat1.id)


@pytest.mark.asyncio
async def test_hidden_account_filtering(
    async_client: AsyncClient,
    test_db_session: AsyncSession,
):
    admin = User(
        email="admin_hide_test@example.com",
        password_hash=hash_password("password123"),
        name="Admin Hide",
        role=UserRole.ADMIN,
        is_active=True,
    )
    test_db_session.add(admin)
    await test_db_session.flush()

    conn = FinancialConnection(
        owner_user_id=admin.id,
        pluggy_item_id="item-hide-01",
        connector_id=1,
        institution_name="Banco Oculto",
        status=ConnectionStatus.CONNECTED,
    )
    test_db_session.add(conn)
    await test_db_session.flush()

    # Conta visível
    acc_vis = Account(
        connection_id=conn.id,
        pluggy_account_id="acc-visible-01",
        name="Conta Visível",
        type=AccountType.BANK,
        current_balance=Decimal("2000.00"),
        owner_context=FinancialContext.HOUSEHOLD,
        is_active=True,
        is_hidden=False,
    )
    # Conta oculta
    acc_hid = Account(
        connection_id=conn.id,
        pluggy_account_id="acc-hidden-01",
        name="Conta Oculta",
        type=AccountType.BANK,
        current_balance=Decimal("8000.00"),
        owner_context=FinancialContext.HOUSEHOLD,
        is_active=True,
        is_hidden=True,
    )
    # Cartão oculto
    card_acc = Account(
        connection_id=conn.id,
        pluggy_account_id="acc-card-hidden-01",
        name="Cartão Oculto",
        type=AccountType.CREDIT,
        current_balance=Decimal("1500.00"),
        credit_limit=Decimal("5000.00"),
        owner_context=FinancialContext.HOUSEHOLD,
        is_active=True,
        is_hidden=True,
    )
    test_db_session.add_all([acc_vis, acc_hid, card_acc])
    await test_db_session.flush()

    now = datetime.now(timezone.utc)
    tx_vis = Transaction(
        account_id=acc_vis.id,
        pluggy_transaction_id="tx-vis-1",
        date=now,
        description="Compra Visível",
        amount=Decimal("-100.00"),
        type=TransactionType.EXPENSE,
        context=FinancialContext.HOUSEHOLD,
        first_seen_at=now,
        last_seen_at=now,
    )
    tx_hid = Transaction(
        account_id=acc_hid.id,
        pluggy_transaction_id="tx-hid-1",
        date=now,
        description="Compra Oculta",
        amount=Decimal("-500.00"),
        type=TransactionType.EXPENSE,
        context=FinancialContext.HOUSEHOLD,
        first_seen_at=now,
        last_seen_at=now,
    )
    test_db_session.add_all([tx_vis, tx_hid])
    await test_db_session.commit()

    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin_hide_test@example.com", "password": "password123"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /accounts padrão só retorna acc_vis
    res_acc = await async_client.get("/api/v1/accounts", headers=headers)
    assert res_acc.status_code == 200
    acc_ids = [a["id"] for a in res_acc.json()]
    assert str(acc_vis.id) in acc_ids
    assert str(acc_hid.id) not in acc_ids
    assert str(card_acc.id) not in acc_ids

    # 2. GET /accounts?include_hidden=true retorna tudo
    res_all_acc = await async_client.get("/api/v1/accounts?include_hidden=true", headers=headers)
    assert res_all_acc.status_code == 200
    all_ids = [a["id"] for a in res_all_acc.json()]
    assert str(acc_vis.id) in all_ids
    assert str(acc_hid.id) in all_ids
    assert str(card_acc.id) in all_ids

    # 3. GET /cards não lista cartão oculto
    res_cards = await async_client.get("/api/v1/cards", headers=headers)
    assert res_cards.status_code == 200
    assert not any(c["id"] == str(card_acc.id) for c in res_cards.json())

    # 4. GET /transactions não lista transações da conta oculta
    res_tx = await async_client.get("/api/v1/transactions", headers=headers)
    assert res_tx.status_code == 200
    tx_ids = [t["id"] for t in res_tx.json()["results"]]
    assert str(tx_vis.id) in tx_ids
    assert str(tx_hid.id) not in tx_ids

    # 5. GET /dashboard/overview calcula saldo apenas da conta visível (R$ 2000, não 10000)
    res_dash = await async_client.get("/api/v1/dashboard/overview", headers=headers)
    assert res_dash.status_code == 200
    data = res_dash.json()
    assert float(data["liquid_balance"]) == 2000.00
    assert float(data["monthly_expenses"]) == 100.00

    # 6. Reexibir conta oculta via PATCH
    unhide_res = await async_client.patch(
        f"/api/v1/accounts/{acc_hid.id}",
        json={"is_hidden": False},
        headers=headers,
    )
    assert unhide_res.status_code == 200
    assert unhide_res.json()["is_hidden"] is False

    # Agora a conta deve aparecer e somar R$ 10000 no saldo
    res_dash_after = await async_client.get("/api/v1/dashboard/overview", headers=headers)
    assert float(res_dash_after.json()["liquid_balance"]) == 10000.00
    assert float(res_dash_after.json()["monthly_expenses"]) == 600.00
