import uuid
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
