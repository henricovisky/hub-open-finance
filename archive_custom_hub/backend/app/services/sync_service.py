import asyncio
import logging
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.integrations.pluggy import PluggyClient
from app.integrations.pluggy.exceptions import PluggyError
from app.models.connection import (
    ConnectionStatus,
    ConnectionSyncRun,
    FinancialConnection,
    SyncStatus,
    SyncTrigger,
    map_pluggy_status_to_internal,
)
from app.models.finance import (
    Account,
    AccountType,
    Card,
    Transaction,
    TransactionStatus,
    TransactionType,
)
from app.models.investment import (
    AssetClass,
    Bill,
    BillStatus,
    Investment,
    InvestmentTransaction,
    WealthSnapshot,
    WealthSnapshotItem,
)

logger = logging.getLogger(__name__)

# Locks por conexão para garantir que apenas uma sincronização execute por vez para a mesma instituição
_connection_locks: Dict[uuid.UUID, asyncio.Lock] = {}
_locks_guard = asyncio.Lock()


async def get_connection_lock(connection_id: uuid.UUID) -> asyncio.Lock:
    async with _locks_guard:
        if connection_id not in _connection_locks:
            _connection_locks[connection_id] = asyncio.Lock()
        return _connection_locks[connection_id]


def normalize_transaction_type(pluggy_type: Optional[str], account_type: AccountType, description: str) -> TransactionType:
    """
    Normalização canônica de tipo de transação conforme DTI §8.1 e §8.2.
    - Na dúvida, UNKNOWN.
    - Pagamento de fatura em cartão é liquidação (não despesa duplicada).
    """
    desc_lower = (description or "").lower()
    type_upper = (pluggy_type or "").upper()

    # Identificação de pagamento de fatura no extrato do cartão
    if account_type == AccountType.CREDIT and "pagamento de fatura" in desc_lower:
        return TransactionType.TRANSFER

    if type_upper == "DEBIT":
        return TransactionType.EXPENSE
    if type_upper == "CREDIT":
        return TransactionType.INCOME
    return TransactionType.UNKNOWN


def categorize_investment(
    inv_type: Optional[str],
    inv_subtype: Optional[str],
    name: str,
    code: Optional[str] = None,
) -> str:
    """
    Classifica uma posição de investimento em uma das classes macro de alocação de ativos:
    - RENDA_FIXA: CDB, LCI, LCA, CRI, CRA, Debêntures, Tesouro Direto, Poupança
    - RENDA_VARIAVEL: Ações B3, ETFs locais
    - FII: Fundos de Investimento Imobiliário
    - FUNDO: Fundos de Investimento Multimercado, Renda Fixa, Ações
    - INTERNACIONAL: BDRs, ETFs globais (IVVB11, SP500, etc.)
    - CRIPTO: Criptoativos e cestas de moedas
    - PREVIDENCIA: Planos PGBL e VGBL
    - OUTROS: Ativos alternativos ou não identificados
    """
    t = (inv_type or "").upper()
    st = (inv_subtype or "").upper()
    n = (name or "").upper()
    c = (code or "").upper()

    # Criptoativos
    if "CRIPTO" in st or "CRYPTO" in st or "BITCOIN" in n or "HASH11" in c or "HASH11" in n:
        return "CRIPTO"

    # Previdência
    if "PREVIDENCIA" in st or "PGBL" in n or "VGBL" in n or "PREV" in n:
        return "PREVIDENCIA"

    # Fundos Imobiliários (FIIs)
    if "FII" in st or "REAL_ESTATE" in st or " FII" in n or "FII " in n or (c.endswith("11") and "IMOB" in n):
        return "FII"

    # Internacional (BDRs, Índices globais)
    if "BDR" in st or "GLOBAL" in st or "BDR" in n or "IVVB11" in c or "IVVB11" in n or "SP500" in n or "S&P" in n or "NASDAQ" in n:
        return "INTERNACIONAL"

    # Renda Fixa
    rf_subtypes = {"CDB", "LCI", "LCA", "CRI", "CRA", "DEBENTURE", "DEBÊNTURE", "TESOURO", "LC", "FIXED_INCOME"}
    if st in rf_subtypes or t == "FIXED_INCOME" or any(k in n for k in ["TESOURO", "CDB", "LCI", "LCA", "DEBENTURE", "POUPANÇA"]):
        return "RENDA_FIXA"

    # Ações / Renda Variável Nacional
    if st in {"STOCK", "ACAO", "AÇÃO", "EQUITY"} or t == "EQUITY":
        return "RENDA_VARIAVEL"
    if c and len(c) in (5, 6) and c[-1] in "3456" and c[:4].isalpha():
        return "RENDA_VARIAVEL"

    # Fundos
    if "MUTUAL_FUND" in t or "FUNDO" in st or "FUNDO" in n or "FIC" in n or "MULTIMERCADO" in n:
        return "FUNDO"

    return "OUTROS"


DEFAULT_ASSET_CLASSES = [
    {"code": "RENDA_FIXA", "name": "Renda Fixa (CDB, LCI, LCA, Tesouro Direto, Debêntures)"},
    {"code": "RENDA_VARIAVEL", "name": "Ações e ETFs Nacionais"},
    {"code": "FII", "name": "Fundos Imobiliários (FIIs)"},
    {"code": "FUNDO", "name": "Fundos de Investimento (Multimercado, Renda Fixa, Ações)"},
    {"code": "INTERNACIONAL", "name": "Internacional (BDRs, Ativos Globais)"},
    {"code": "CRIPTO", "name": "Criptoativos"},
    {"code": "PREVIDENCIA", "name": "Previdência Privada (PGBL / VGBL)"},
    {"code": "OUTROS", "name": "Outros Ativos / Alternativos"},
]


class SyncService:
    """Orquestrador de sincronização idempotente de contas, transações, faturas e investimentos."""

    @staticmethod
    async def ensure_asset_classes(db: AsyncSession) -> Dict[str, uuid.UUID]:
        """Carrega e garante a presença das classes macro de alocação de ativos."""
        stmt = select(AssetClass)
        res = await db.execute(stmt)
        classes = {ac.code: ac.id for ac in res.scalars().all()}

        now = datetime.now(timezone.utc)
        created_any = False
        for def_ac in DEFAULT_ASSET_CLASSES:
            if def_ac["code"] not in classes:
                new_ac = AssetClass(
                    id=uuid.uuid4(),
                    code=def_ac["code"],
                    name=def_ac["name"],
                    created_at=now,
                )
                db.add(new_ac)
                await db.flush()
                classes[def_ac["code"]] = new_ac.id
                created_any = True

        if created_any:
            await db.commit()

        return classes

    @staticmethod
    async def sync_connection(
        db: AsyncSession,
        connection_id: uuid.UUID,
        client: PluggyClient,
        trigger: SyncTrigger = SyncTrigger.MANUAL,
    ) -> ConnectionSyncRun:
        """
        Executa a sincronização completa e idempotente de uma conexão financeira:
        1. Consulta estado atual do Item na Pluggy.
        2. Sincroniza contas (upsert).
        3. Sincroniza transações (upsert com paginação assíncrona por cursor).
        4. Sincroniza faturas de cartões de crédito (bills) com tolerância a indisponibilidade.
        5. Sincroniza posições de investimentos e custódia com tolerância a indisponibilidade.
        6. Gera o snapshot consolidado de patrimônio líquido da data.
        7. Registra histórico e contadores em connection_sync_runs.
        """
        conn_lock = await get_connection_lock(connection_id)
        if conn_lock.locked():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Uma sincronização já está em andamento para esta conexão.",
            )

        async with conn_lock:
            stmt = select(FinancialConnection).where(
                FinancialConnection.id == connection_id,
                FinancialConnection.deleted_at.is_(None),
            )
            result = await db.execute(stmt)
            conn = result.scalar_one_or_none()

            if not conn:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Conexão não encontrada para sincronização.",
                )

            now = datetime.now(timezone.utc)

            # Inicia o registro da execução
            sync_run = ConnectionSyncRun(
                connection_id=conn.id,
                trigger=trigger,
                status=SyncStatus.RUNNING,
                started_at=now,
            )
            db.add(sync_run)
            conn.status = ConnectionStatus.SYNCING
            await db.commit()
            await db.refresh(sync_run)

            records_read = 0
            records_inserted = 0
            records_updated = 0

            try:
                # 1. Consulta metadados do Item na Pluggy
                pluggy_item = await client.items.get(conn.pluggy_item_id)
                conn.status = map_pluggy_status_to_internal(pluggy_item.status)
                conn.raw_status = pluggy_item.status
                conn.status_detail = pluggy_item.status_detail

                # 2. Sincroniza Contas
                pluggy_accounts = await client.accounts.list(item_id=conn.pluggy_item_id)
                account_map: Dict[str, Account] = {}

                for p_acc in pluggy_accounts:
                    acc_stmt = select(Account).where(Account.pluggy_account_id == p_acc.id)
                    acc_result = await db.execute(acc_stmt)
                    account = acc_result.scalar_one_or_none()

                    acc_type_str = (p_acc.type or "BANK").upper()
                    acc_type = AccountType(acc_type_str) if acc_type_str in AccountType.__members__ else AccountType.OTHER

                    if account:
                        account.name = p_acc.name
                        account.type = acc_type
                        account.subtype = p_acc.subtype
                        account.current_balance = p_acc.balance
                        account.currency = p_acc.currency_code
                        account.last_synced_at = now
                    else:
                        account = Account(
                            connection_id=conn.id,
                            pluggy_account_id=p_acc.id,
                            name=p_acc.name,
                            type=acc_type,
                            subtype=p_acc.subtype,
                            currency=p_acc.currency_code,
                            current_balance=p_acc.balance,
                            owner_context="HOUSEHOLD",
                            is_active=True,
                            last_synced_at=now,
                        )
                        db.add(account)

                    await db.flush()
                    account_map[p_acc.id] = account

                    # Sincroniza cartão se for conta do tipo CREDIT
                    if acc_type == AccountType.CREDIT:
                        card_stmt = select(Card).where(Card.account_id == account.id)
                        card_res = await db.execute(card_stmt)
                        card = card_res.scalar_one_or_none()
                        if not card:
                            card = Card(
                                account_id=account.id,
                                display_name=p_acc.name,
                            )
                            db.add(card)

                await db.commit()

                # 3. Sincroniza Transações para cada conta
                for pluggy_acc_id, account in account_map.items():
                    try:
                        async for p_tx in client.transactions.iterate(account_id=pluggy_acc_id):
                            records_read += 1
                            tx_stmt = select(Transaction).where(Transaction.pluggy_transaction_id == p_tx.id)
                            tx_res = await db.execute(tx_stmt)
                            local_tx = tx_res.scalar_one_or_none()

                            tx_type = normalize_transaction_type(p_tx.type, account.type, p_tx.description)
                            tx_status = TransactionStatus.POSTED if (p_tx.status or "").upper() == "POSTED" else TransactionStatus.PENDING

                            if local_tx:
                                local_tx.description = p_tx.description
                                local_tx.amount = p_tx.amount
                                local_tx.date = p_tx.date
                                local_tx.type = tx_type
                                local_tx.status = tx_status
                                local_tx.provider_category = p_tx.category
                                local_tx.last_seen_at = now
                                records_updated += 1
                            else:
                                local_tx = Transaction(
                                    account_id=account.id,
                                    pluggy_transaction_id=p_tx.id,
                                    date=p_tx.date,
                                    description=p_tx.description,
                                    amount=p_tx.amount,
                                    currency=p_tx.currency_code,
                                    type=tx_type,
                                    status=tx_status,
                                    provider_category=p_tx.category,
                                    context=account.owner_context,
                                    first_seen_at=now,
                                    last_seen_at=now,
                                )
                                db.add(local_tx)
                                records_inserted += 1
                    except Exception as tx_err:
                        logger.warning("Falha ao iterar transações da conta %s: %s", pluggy_acc_id, tx_err)

                # 4. Sincroniza Faturas de Cartão (Bills)
                for pluggy_acc_id, account in account_map.items():
                    if account.type == AccountType.CREDIT:
                        try:
                            bills_data = await client.bills.list(account_id=pluggy_acc_id)
                            card_stmt = select(Card).where(Card.account_id == account.id)
                            card_res = await db.execute(card_stmt)
                            card = card_res.scalar_one_or_none()

                            for p_bill in bills_data:
                                records_read += 1
                                b_stmt = select(Bill).where(Bill.pluggy_bill_id == p_bill.id)
                                b_res = await db.execute(b_stmt)
                                local_bill = b_res.scalar_one_or_none()

                                b_status = (p_bill.status or "OPEN").upper()
                                if local_bill:
                                    local_bill.due_date = p_bill.due_date
                                    local_bill.closing_date = p_bill.closing_date
                                    local_bill.total_amount = p_bill.total_amount
                                    local_bill.paid_amount = p_bill.paid_amount
                                    local_bill.status = b_status
                                    records_updated += 1
                                else:
                                    local_bill = Bill(
                                        account_id=account.id,
                                        card_id=card.id if card else None,
                                        pluggy_bill_id=p_bill.id,
                                        due_date=p_bill.due_date,
                                        closing_date=p_bill.closing_date,
                                        total_amount=p_bill.total_amount,
                                        paid_amount=p_bill.paid_amount,
                                        status=b_status,
                                    )
                                    db.add(local_bill)
                                    records_inserted += 1
                        except Exception as bill_err:
                            logger.info("Faturas indisponíveis ou não suportadas para a conta %s: %s", pluggy_acc_id, bill_err)

                # 5. Sincroniza Investimentos
                asset_classes_map = await SyncService.ensure_asset_classes(db)
                try:
                    investments_data = await client.investments.list(item_id=conn.pluggy_item_id)
                    # Encontra uma conta de investimento para associar, ou utiliza a primeira disponível
                    inv_account = next((a for a in account_map.values() if a.type == AccountType.INVESTMENT), None)
                    if not inv_account and account_map:
                        inv_account = list(account_map.values())[0]

                    if inv_account and investments_data:
                        for p_inv in investments_data:
                            records_read += 1
                            inv_stmt = select(Investment).where(Investment.pluggy_investment_id == p_inv.id)
                            inv_res = await db.execute(inv_stmt)
                            local_inv = inv_res.scalar_one_or_none()

                            macro_class = categorize_investment(
                                inv_type=p_inv.type,
                                inv_subtype=p_inv.subtype,
                                name=p_inv.name,
                                code=p_inv.code,
                            )
                            asset_class_id = asset_classes_map.get(macro_class)
                            bal = p_inv.balance if p_inv.balance is not None else (p_inv.value or Decimal("0.00"))

                            if local_inv:
                                local_inv.name = p_inv.name
                                local_inv.type = p_inv.type
                                local_inv.subtype = p_inv.subtype
                                local_inv.code = p_inv.code
                                local_inv.balance = bal
                                local_inv.currency = p_inv.currency_code or "BRL"
                                local_inv.due_date = p_inv.due_date
                                local_inv.asset_class_id = asset_class_id
                                local_inv.source_updated_at = now
                                records_updated += 1
                            else:
                                local_inv = Investment(
                                    account_id=inv_account.id,
                                    pluggy_investment_id=p_inv.id,
                                    name=p_inv.name,
                                    type=p_inv.type,
                                    subtype=p_inv.subtype,
                                    code=p_inv.code,
                                    balance=bal,
                                    invested_amount=p_inv.amount,
                                    quantity=p_inv.quantity,
                                    value=p_inv.value,
                                    currency=p_inv.currency_code or "BRL",
                                    due_date=p_inv.due_date,
                                    asset_class_id=asset_class_id,
                                    source_updated_at=now,
                                )
                                db.add(local_inv)
                                records_inserted += 1
                except Exception as inv_err:
                    logger.info("Investimentos indisponíveis ou não suportados para a conexão %s: %s", conn.id, inv_err)

                # 6. Gera o snapshot consolidado de patrimônio líquido da data
                await db.commit()
                await SyncService.generate_daily_wealth_snapshot(db)

                # Conclui com sucesso
                conn.last_sync_at = now
                conn.last_successful_sync_at = now
                sync_run.status = SyncStatus.SUCCESS
                sync_run.finished_at = datetime.now(timezone.utc)
                sync_run.records_read = records_read
                sync_run.records_inserted = records_inserted
                sync_run.records_updated = records_updated
                await db.commit()
                await db.refresh(sync_run)
                return sync_run

            except Exception as exc:
                sync_run.status = SyncStatus.FAILED
                sync_run.finished_at = datetime.now(timezone.utc)
                sync_run.error_code = "SYNC_ERROR"
                sync_run.error_message_safe = str(exc)[:500]
                conn.status = ConnectionStatus.ATTENTION
                await db.commit()
                raise

    @staticmethod
    async def generate_daily_wealth_snapshot(
        db: AsyncSession,
        target_date: Optional[date] = None,
    ) -> WealthSnapshot:
        """
        Calcula e persiste a fotografia consolidada do patrimônio líquido familiar e individual:
        - Saldo em dinheiro (contas correntes e poupança)
        - Posições em custódia de investimentos
        - Dívida de cartão de crédito (faturas abertas/fechadas pendentes)
        - Patrimônio Líquido Total = Dinheiro + Investimentos - Cartão
        - Divisão entre Casa (Household) e Pessoal (Personal)
        - Alocação percentual por classe de ativos
        """
        snapshot_day = target_date or date.today()

        # 1. Saldo em Contas (Bancárias)
        acc_stmt = select(Account).where(Account.is_active == True)
        acc_res = await db.execute(acc_stmt)
        accounts = acc_res.scalars().all()

        cash_balance = Decimal("0.00")
        cash_household = Decimal("0.00")
        cash_personal = Decimal("0.00")

        for acc in accounts:
            if acc.type in (AccountType.BANK, AccountType.OTHER):
                bal = acc.current_balance or Decimal("0.00")
                cash_balance += bal
                ctx = (acc.owner_context.value if hasattr(acc.owner_context, "value") else str(acc.owner_context)).upper()
                if "HOUSEHOLD" in ctx:
                    cash_household += bal
                else:
                    cash_personal += bal

        # 2. Posições de Investimentos
        inv_stmt = select(Investment).options(selectinload(Investment.account), selectinload(Investment.asset_class))
        inv_res = await db.execute(inv_stmt)
        investments = inv_res.scalars().all()

        investment_balance = Decimal("0.00")
        inv_household = Decimal("0.00")
        inv_personal = Decimal("0.00")
        asset_class_totals: Dict[str, Tuple[str, Optional[uuid.UUID], Decimal]] = {}

        for inv in investments:
            bal = inv.balance or Decimal("0.00")
            investment_balance += bal

            # Contexto herdado da conta associada
            if inv.account and inv.account.owner_context:
                ctx = (inv.account.owner_context.value if hasattr(inv.account.owner_context, "value") else str(inv.account.owner_context)).upper()
            else:
                ctx = "HOUSEHOLD"

            if "HOUSEHOLD" in ctx:
                inv_household += bal
            else:
                inv_personal += bal

            # Agregação por classe de ativos
            ac_code = inv.asset_class.code if inv.asset_class else "OUTROS"
            ac_name = inv.asset_class.name if inv.asset_class else "Outros Ativos"
            ac_id = inv.asset_class.id if inv.asset_class else None

            if ac_code not in asset_class_totals:
                asset_class_totals[ac_code] = (ac_name, ac_id, Decimal("0.00"))
            curr_name, curr_id, curr_bal = asset_class_totals[ac_code]
            asset_class_totals[ac_code] = (curr_name, curr_id, curr_bal + bal)

        # 3. Dívida de Cartões de Crédito (faturas OPEN ou CLOSED pendentes de pagamento)
        bill_stmt = select(Bill).options(selectinload(Bill.account)).where(
            Bill.status.in_(["OPEN", "CLOSED", "OVERDUE"])
        )
        bill_res = await db.execute(bill_stmt)
        bills = bill_res.scalars().all()

        credit_card_debt = Decimal("0.00")
        debt_household = Decimal("0.00")
        debt_personal = Decimal("0.00")

        for b in bills:
            tot = b.total_amount or Decimal("0.00")
            paid = b.paid_amount or Decimal("0.00")
            remaining = max(Decimal("0.00"), tot - paid)
            credit_card_debt += remaining

            if b.account and b.account.owner_context:
                ctx = (b.account.owner_context.value if hasattr(b.account.owner_context, "value") else str(b.account.owner_context)).upper()
            else:
                ctx = "HOUSEHOLD"

            if "HOUSEHOLD" in ctx:
                debt_household += remaining
            else:
                debt_personal += remaining

        # 4. Totais e Partição Patrimonial
        net_worth = cash_balance + investment_balance - credit_card_debt
        household_net_worth = cash_household + inv_household - debt_household
        personal_net_worth = cash_personal + inv_personal - debt_personal

        # 5. Upsert de WealthSnapshot
        snap_stmt = select(WealthSnapshot).where(WealthSnapshot.snapshot_date == snapshot_day)
        snap_res = await db.execute(snap_stmt)
        snapshot = snap_res.scalar_one_or_none()

        if snapshot:
            snapshot.cash_balance = cash_balance
            snapshot.investment_balance = investment_balance
            snapshot.credit_card_debt = credit_card_debt
            snapshot.net_worth = net_worth
            snapshot.household_net_worth = household_net_worth
            snapshot.personal_net_worth = personal_net_worth
        else:
            snapshot = WealthSnapshot(
                snapshot_date=snapshot_day,
                cash_balance=cash_balance,
                investment_balance=investment_balance,
                credit_card_debt=credit_card_debt,
                net_worth=net_worth,
                household_net_worth=household_net_worth,
                personal_net_worth=personal_net_worth,
            )
            db.add(snapshot)

        await db.flush()

        # Remove itens anteriores deste snapshot para reconstrução limpa
        delete_items_stmt = select(WealthSnapshotItem).where(WealthSnapshotItem.snapshot_id == snapshot.id)
        existing_items = (await db.execute(delete_items_stmt)).scalars().all()
        for item in existing_items:
            await db.delete(item)

        # Adiciona itens de alocação por classe
        for code, (name, ac_id, bal) in asset_class_totals.items():
            pct = (bal / investment_balance * 100) if investment_balance > 0 else Decimal("0.00")
            snap_item = WealthSnapshotItem(
                snapshot_id=snapshot.id,
                asset_class_id=ac_id,
                asset_class_code=code,
                asset_class_name=name,
                balance=bal,
                percentage=round(pct, 2),
            )
            db.add(snap_item)

        await db.commit()
        await db.refresh(snapshot)
        return snapshot
