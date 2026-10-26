import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_user
from app.api.v1.accounts import get_authorized_account_ids
from app.core.database import get_db_session
from app.models.base import FinancialContext, UserRole
from app.models.finance import Account, AccountType, Card, Transaction, TransactionType
from app.models.investment import Bill
from app.models.user import User

router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("")
async def list_cards(
    context: Optional[FinancialContext] = None,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Retorna lista de cartões de crédito ativos com saldos e limites.
    Conforme matriz de permissões e contexto selecionado.
    """
    authorized_acc_ids = await get_authorized_account_ids(db, current_user)
    stmt = (
        select(Account)
        .options(selectinload(Account.card))
        .where(Account.type == AccountType.CREDIT, Account.is_active == True)
    )
    if authorized_acc_ids is not None:
        if not authorized_acc_ids:
            return []
        stmt = stmt.where(Account.id.in_(authorized_acc_ids))
    if context and context != FinancialContext.CONSOLIDATED:
        stmt = stmt.where(Account.owner_context == context)
    elif current_user.role == UserRole.MEMBER:
        stmt = stmt.where(Account.owner_context == FinancialContext.HOUSEHOLD)

    result = await db.execute(stmt)
    accounts = result.scalars().all()
    cards_list = []
    for acc in accounts:
        last_four = acc.card.last_four_digits if acc.card else None
        closing_day = acc.card.closing_day if acc.card else None
        due_day = acc.card.due_day if acc.card else None

        if due_day is None or closing_day is None:
            bill_stmt = (
                select(Bill)
                .where(Bill.account_id == acc.id)
                .order_by(Bill.due_date.desc())
                .limit(1)
            )
            bill_res = await db.execute(bill_stmt)
            latest_bill = bill_res.scalar_one_or_none()
            if latest_bill and latest_bill.due_date:
                if due_day is None:
                    due_day = latest_bill.due_date.day
                if closing_day is None:
                    closing_day = (latest_bill.due_date - timedelta(days=7)).day

        cards_list.append({
            "id": str(acc.id),
            "account_id": str(acc.id),
            "name": acc.name,
            "current_balance": str(acc.current_balance or Decimal("0.00")),
            "credit_limit": str(acc.credit_limit) if acc.credit_limit is not None else None,
            "available_limit": str(acc.available_balance) if acc.available_balance is not None else None,
            "last_four_digits": last_four,
            "closing_day": closing_day,
            "due_day": due_day,
            "owner_context": acc.owner_context.value if hasattr(acc.owner_context, "value") else str(acc.owner_context),
        })
    return cards_list


@router.get("/{id}/limit-usage")
async def get_card_limit_usage(
    id: uuid.UUID,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Retorna o uso do limite do cartão (G-08).
    Conforme 04 Adendo de API §2.
    """
    authorized_acc_ids = await get_authorized_account_ids(db, current_user)

    # Busca a conta ou o cartão
    stmt = (
        select(Account)
        .options(selectinload(Account.card))
        .where(Account.id == id, Account.type == AccountType.CREDIT)
    )
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cartão não encontrado.")

    if authorized_acc_ids is not None and account.id not in authorized_acc_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não autorizado a este cartão.")

    limit_val = account.credit_limit
    available_val = account.available_balance
    current_bill_val = account.current_balance or Decimal("0.00")

    if limit_val is None:
        return {
            "data": {
                "bill_current": str(current_bill_val.quantize(Decimal("0.01"))),
                "installments_future": "0.00",
                "available": None,
                "limit": None,
            },
            "meta": {
                "availability": "UNAVAILABLE",
                "reason": "Instituição bancária não fornece informações de limite via Open Finance",
            },
        }

    available_final = available_val if available_val is not None else (limit_val - current_bill_val)

    return {
        "data": {
            "bill_current": str(current_bill_val.quantize(Decimal("0.01"))),
            "installments_future": "0.00",
            "available": str(available_final.quantize(Decimal("0.01"))),
            "limit": str(limit_val.quantize(Decimal("0.01"))),
        },
        "meta": {
            "availability": "AVAILABLE",
        },
    }
