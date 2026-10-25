import asyncio
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.integrations.pluggy import PluggyClient
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


class SyncService:
    """Orquestrador de sincronização idempotente de conexões, contas e transações."""

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
        4. Registra histórico e contadores em connection_sync_runs.
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
                            owner_context=conn.owner.role.value if hasattr(conn, "owner") and False else conn.status,  # fallback
                            is_active=True,
                            last_synced_at=now,
                        )
                        # Define contexto padrão como HOUSEHOLD se novo
                        account.owner_context = "HOUSEHOLD"
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
