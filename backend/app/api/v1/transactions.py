import uuid
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import require_user
from app.api.v1.accounts import get_authorized_account_ids
from app.core.database import get_db_session
from app.models.base import FinancialContext, UserRole
from app.models.finance import Transaction, TransactionType
from app.models.user import AccountPermission, User
from app.schemas.finance import (
    TransactionListResponse,
    TransactionResponse,
    TransactionUpdate,
)

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    context: Optional[FinancialContext] = None,
    account_id: Optional[uuid.UUID] = None,
    transaction_type: Optional[TransactionType] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Lista movimentações financeiras com filtros de contexto, período e tipo.
    Aplica rigorosamente a matriz de permissões (MEMBER só visualiza lançamentos de contas autorizadas).
    """
    authorized_ids = await get_authorized_account_ids(db, current_user)

    if account_id:
        if authorized_ids is not None and account_id not in authorized_ids:
            return TransactionListResponse(results=[], total=0, page=page, page_size=page_size)
        base_filter = [Transaction.account_id == account_id]
    else:
        if authorized_ids is not None:
            if not authorized_ids:
                return TransactionListResponse(results=[], total=0, page=page, page_size=page_size)
            base_filter = [Transaction.account_id.in_(authorized_ids)]
        else:
            base_filter = []

    if context:
        base_filter.append(Transaction.context == context)
    if transaction_type:
        base_filter.append(Transaction.type == transaction_type)
    if from_date:
        base_filter.append(Transaction.date >= from_date)
    if to_date:
        base_filter.append(Transaction.date <= to_date)

    # Contagem total
    count_stmt = select(func.count(Transaction.id)).where(*base_filter)
    count_res = await db.execute(count_stmt)
    total_records = count_res.scalar() or 0

    # Consulta paginada
    offset = (page - 1) * page_size
    stmt = (
        select(Transaction)
        .where(*base_filter)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    transactions = list(result.scalars().all())

    return TransactionListResponse(
        results=[TransactionResponse.model_validate(t) for t in transactions],
        total=total_records,
        page=page,
        page_size=page_size,
    )


@router.get("/{id}", response_model=TransactionResponse)
async def get_transaction(
    id: uuid.UUID,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Consulta detalhes de uma transação específica."""
    stmt = select(Transaction).where(Transaction.id == id)
    result = await db.execute(stmt)
    tx = result.scalar_one_or_none()

    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transação não encontrada.")

    if current_user.role != UserRole.ADMIN:
        perm_stmt = select(AccountPermission).where(
            AccountPermission.user_id == current_user.id,
            AccountPermission.account_id == tx.account_id,
            AccountPermission.can_view == True,
        )
        perm = (await db.execute(perm_stmt)).scalar_one_or_none()
        if not perm:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transação não encontrada.")

    return TransactionResponse.model_validate(tx)


@router.patch("/{id}", response_model=TransactionResponse)
async def update_transaction(
    id: uuid.UUID,
    payload: TransactionUpdate,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Atualiza metadados editáveis da transação:
    - category_id: classificação financeira
    - context: Casa (HOUSEHOLD) ou Pessoal (PERSONAL)
    - is_ignored_in_analytics: desconsidera em cálculos de orçamento/média
    """
    stmt = select(Transaction).where(Transaction.id == id)
    result = await db.execute(stmt)
    tx = result.scalar_one_or_none()

    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transação não encontrada.")

    if current_user.role != UserRole.ADMIN:
        perm_stmt = select(AccountPermission).where(
            AccountPermission.user_id == current_user.id,
            AccountPermission.account_id == tx.account_id,
            AccountPermission.can_categorize == True,
        )
        perm = (await db.execute(perm_stmt)).scalar_one_or_none()
        if not perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permissão insuficiente para categorizar transações desta conta.",
            )

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(tx, field, val)

    await db.commit()
    await db.refresh(tx)
    return TransactionResponse.model_validate(tx)


from pydantic import BaseModel

class BulkTransactionUpdate(BaseModel):
    transaction_ids: List[uuid.UUID]
    category_id: Optional[uuid.UUID] = None
    context: Optional[FinancialContext] = None
    is_ignored_in_analytics: Optional[bool] = None


@router.patch("/bulk")
async def bulk_update_transactions(
    payload: BulkTransactionUpdate,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Atualiza transações em lote (categorização e contexto).
    Valida permissão can_categorize item a item. Conforme 04 Adendo §6.
    """
    if not payload.transaction_ids:
        return {"updated_count": 0}

    stmt = select(Transaction).where(Transaction.id.in_(payload.transaction_ids))
    result = await db.execute(stmt)
    txs = list(result.scalars().all())

    if current_user.role != UserRole.ADMIN:
        account_ids = {t.account_id for t in txs}
        perm_stmt = select(AccountPermission.account_id).where(
            AccountPermission.user_id == current_user.id,
            AccountPermission.account_id.in_(account_ids),
            AccountPermission.can_categorize == True,
        )
        allowed_acc_ids = set((await db.execute(perm_stmt)).scalars().all())
    else:
        allowed_acc_ids = None

    updated_count = 0
    for tx in txs:
        if allowed_acc_ids is not None and tx.account_id not in allowed_acc_ids:
            continue

        if payload.category_id is not None:
            tx.category_id = payload.category_id
        if payload.context is not None:
            tx.context = payload.context
        if payload.is_ignored_in_analytics is not None:
            tx.is_ignored_in_analytics = payload.is_ignored_in_analytics

        updated_count += 1

    await db.commit()
    return {"updated_count": updated_count}


